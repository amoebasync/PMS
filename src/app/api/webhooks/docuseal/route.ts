import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadSignedPdf } from '@/lib/docuseal';
import { uploadToS3 } from '@/lib/s3';
import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * POST /api/webhooks/docuseal — DocuSeal Webhook受信
 * form.completed イベントで署名完了を処理
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const eventType = payload.event_type;

    console.log(`[DocuSeal Webhook] event: ${eventType}`);

    // form.completed: 配布員が署名完了
    if (eventType === 'form.completed') {
      const data = payload.data;
      const externalId = data.external_id;
      const submitterId = data.id;
      const completedAt = data.completed_at;
      const documents = data.documents || [];
      const combinedUrl = data.submission?.combined_document_url;
      const email = data.email;
      const name = data.name;

      if (!externalId) {
        console.log('[DocuSeal Webhook] No external_id, skipping');
        return NextResponse.json({ ok: true });
      }

      const distributorId = parseInt(externalId, 10);
      const distributor = await prisma.flyerDistributor.findUnique({
        where: { id: distributorId },
      });

      if (!distributor) {
        console.log(`[DocuSeal Webhook] Distributor ${distributorId} not found`);
        return NextResponse.json({ ok: true });
      }

      // 1. 署名済みPDFをダウンロード
      const pdfUrl = combinedUrl || documents[0]?.url;
      let s3Key = '';
      if (pdfUrl) {
        try {
          const pdfBuffer = await downloadSignedPdf(pdfUrl);
          s3Key = `uploads/contracts/${distributorId}/${Date.now()}_contract.pdf`;
          await uploadToS3(pdfBuffer, s3Key, 'application/pdf');
          console.log(`[DocuSeal Webhook] PDF uploaded to S3: ${s3Key}`);
        } catch (err) {
          console.error('[DocuSeal Webhook] PDF upload failed:', err);
        }
      }

      // 2. DB更新
      await prisma.flyerDistributor.update({
        where: { id: distributorId },
        data: {
          contractStatus: 'SIGNED',
          contractDate: completedAt ? new Date(completedAt) : new Date(),
          contractPdfUrl: s3Key || null,
          hasSignedContract: true,
          docusealSubmitterId: submitterId,
        },
      });

      // 3. 署名済みPDFを配布員にメール送信
      if (email && s3Key) {
        try {
          const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
          const logoUrl = `${siteUrl}/logo/logo_dark_transparent.png`;

          // S3からPDFを再取得してメール添付
          const pdfForEmail = await downloadSignedPdf(pdfUrl!);

          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@tiramis.co.jp',
            to: email,
            subject: '【株式会社ティラミス】業務委託契約書（署名済み）',
            html: `
              <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
                <div style="background:#1e293b;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
                  <img src="${logoUrl}" alt="Logo" style="height:36px;" />
                </div>
                <div style="padding:30px;background:#fff;border:1px solid #e2e8f0;border-top:none;">
                  <h2 style="color:#1e293b;margin:0 0 16px;">業務委託契約書 — 署名完了</h2>
                  <p style="color:#475569;line-height:1.7;">
                    ${name} 様<br><br>
                    業務委託契約書の署名が完了しました。<br>
                    署名済みの契約書をPDFファイルとして添付しております。<br>
                    ご確認のほどよろしくお願いいたします。
                  </p>
                </div>
                <div style="padding:16px;background:#f8fafc;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
                  <p style="color:#94a3b8;font-size:12px;margin:0;">株式会社ティラミス</p>
                </div>
              </div>
            `,
            attachments: [
              {
                filename: `業務委託契約書_${name}.pdf`,
                content: pdfForEmail,
                contentType: 'application/pdf',
              },
            ],
          });
          console.log(`[DocuSeal Webhook] Contract PDF emailed to ${email}`);
        } catch (err) {
          console.error('[DocuSeal Webhook] Email send failed:', err);
        }
      }

      console.log(`[DocuSeal Webhook] Distributor ${distributorId} contract signed successfully`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DocuSeal Webhook] Error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to prevent retries
  }
}
