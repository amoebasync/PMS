import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─────────────────────────────────────────────────────────
// 共通 HTML ラッパー（ロゴヘッダー ＋ 署名フッター）
// ─────────────────────────────────────────────────────────
function htmlWrapper(contentHtml: string): string {
  const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
  const logoUrl = `${siteUrl}/logo/logo_dark_transparent.png`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- ロゴヘッダー -->
          <tr>
            <td style="background:#1e293b;padding:28px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Tiramis" height="38" style="display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td style="padding:40px 40px 32px;color:#1e293b;font-size:14px;line-height:1.8;">
              ${contentHtml}
            </td>
          </tr>

          <!-- 署名フッター -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:28px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#334155;">株式会社ティラミス</p>
                    <p style="margin:0 0 4px;font-size:13px;color:#64748b;">
                      Web: <a href="${siteUrl}" style="color:#6366f1;text-decoration:none;">${siteUrl}</a>
                    </p>
                    <p style="margin:0;font-size:13px;color:#64748b;">
                      Email: <a href="mailto:info@tiramis.co.jp" style="color:#6366f1;text-decoration:none;">info@tiramis.co.jp</a>
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;">
                ※ このメールは自動送信です。本メールへの返信はお受けできません。<br>
                お問い合わせは上記メールアドレスまでご連絡ください。
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────
// 0. 社員アカウント作成通知（管理者が社員を新規登録したとき）
// ─────────────────────────────────────────────────────────
export const sendEmployeeWelcomeEmail = async (
  toEmail: string,
  lastName: string,
  firstName: string,
  employeeCode: string,
  initialPassword: string,
  loginUrl: string,
) => {
  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${lastName} ${firstName} さん</p>
    <p style="margin:0 0 16px;">
      株式会社ティラミスの社内管理システム（PMS Pro）へのアカウントが作成されました。<br>
      以下のログイン情報でシステムにアクセスしてください。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">ログイン情報</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#64748b;width:160px;">ログインURL</td>
            <td style="padding:8px 0;"><a href="${loginUrl}" style="color:#6366f1;font-weight:bold;">${loginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;">社員コード</td>
            <td style="padding:8px 0;font-weight:bold;font-family:monospace;font-size:15px;">${employeeCode}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;">メールアドレス</td>
            <td style="padding:8px 0;font-weight:bold;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;">初期パスワード</td>
            <td style="padding:8px 0;font-weight:bold;font-family:monospace;font-size:15px;">${initialPassword}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#854d0e;">
        <strong>⚠ 初回ログイン時に必ずパスワードを変更してください。</strong><br>
        初期パスワードは生年月日（YYYYMMDD形式）です。ログイン後、新しいパスワードへの変更が求められます。
      </p>
    </div>

    <div style="text-align:center;margin:32px 0 24px;">
      <a href="${loginUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">ログインする</a>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      ご不明な点は担当者または管理者までお問い合わせください。
    </p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis PMS Pro" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject: '【Tiramis PMS Pro】アカウントが作成されました',
    html: htmlWrapper(contentHtml),
    text: `${lastName} ${firstName} さん\n\nPMS Proのアカウントが作成されました。\n\nログインURL: ${loginUrl}\n社員コード: ${employeeCode}\nメールアドレス: ${toEmail}\n初期パスワード: ${initialPassword}\n\n初回ログイン時に必ずパスワードを変更してください。\n\nご不明な点は管理者までお問い合わせください。`,
  });
};

// ─────────────────────────────────────────────────────────
// 1. 担当者ログイン情報（管理者がコンタクトを作成したとき）
// ─────────────────────────────────────────────────────────
export const sendContactCredentials = async (
  toEmail: string,
  lastName: string,
  firstName: string,
  companyName: string,
  loginUrl: string,
  plainPassword: string,
) => {
  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${lastName} ${firstName} 様</p>
    <p style="margin:0 0 16px;">
      ${companyName} のECポータルサイトにアカウントが作成されました。<br>
      以下のログイン情報でポータルにアクセスしてください。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">ログイン情報</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">ログインURL</td>
            <td style="padding:6px 0;"><a href="${loginUrl}" style="color:#6366f1;">${loginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">メールアドレス</td>
            <td style="padding:6px 0;font-weight:bold;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">初期パスワード</td>
            <td style="padding:6px 0;font-weight:bold;font-family:monospace;font-size:15px;">${plainPassword}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#854d0e;">
        <strong>⚠ セキュリティのため、初回ログイン後に必ずパスワードを変更してください。</strong>
      </p>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">ご不明な点は担当営業までお問い合わせください。</p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis ECポータル" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject: '【Tiramis ECポータル】ログイン情報のお知らせ',
    html: htmlWrapper(contentHtml),
    text: `${lastName} ${firstName} 様\n\n${companyName} のECポータルサイトにアカウントが作成されました。\n\nログインURL: ${loginUrl}\nメールアドレス: ${toEmail}\n初期パスワード: ${plainPassword}\n\nセキュリティのため、初回ログイン後に必ずパスワードを変更してください。`,
  });
};

// ─────────────────────────────────────────────────────────
// 2. QRコードスキャン通知
// ─────────────────────────────────────────────────────────
export const sendScanNotification = async (
  emails: string[],
  qrCode: any,
  flyerName: string,
  location: string | null,
  device: string,
) => {
  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 16px;">チラシのQRコードがスキャンされました</p>
    <p style="margin:0 0 24px;color:#475569;">リアルタイムの反響をお知らせします。</p>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 24px;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">スキャン情報</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:140px;">対象チラシ</td>
            <td style="padding:6px 0;font-weight:bold;">${flyerName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">QRメモ</td>
            <td style="padding:6px 0;">${qrCode.memo || 'なし'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">スキャン日時</td>
            <td style="padding:6px 0;">${new Date().toLocaleString('ja-JP')}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">推定エリア</td>
            <td style="padding:6px 0;">${location || '不明'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">使用端末</td>
            <td style="padding:6px 0;">${device}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0;color:#64748b;font-size:13px;">引き続き、Tiramis ECポータルにて詳細な反響分析をご確認いただけます。</p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis ECポータル" <noreply@tiramis.co.jp>',
    to: emails.join(', '),
    subject: `【速報】チラシ「${flyerName}」のQRコードがスキャンされました！`,
    html: htmlWrapper(contentHtml),
    text: `チラシのQRコードがスキャンされました。\n\n対象チラシ: ${flyerName}\nQRメモ: ${qrCode.memo || 'なし'}\nスキャン日時: ${new Date().toLocaleString('ja-JP')}\n推定エリア: ${location || '不明'}\n使用端末: ${device}`,
  });
};

// ─────────────────────────────────────────────────────────
// 3. 新規会員登録完了
// ─────────────────────────────────────────────────────────
export const sendWelcomeEmail = async (
  toEmail: string,
  lastName: string,
  firstName: string,
  loginUrl: string,
  companyName?: string,
) => {
  const nameLabel = companyName ? `${companyName} ご担当者` : `${lastName} ${firstName}`;

  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${nameLabel} 様</p>
    <p style="margin:0 0 16px;">
      この度はTiramis ECポータルにご登録いただき、誠にありがとうございます。<br>
      以下のURLよりポータルにログインしてサービスをご利用ください。
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">ポータルにログインする</a>
    </div>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 24px;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">ログイン情報</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">ログインURL</td>
            <td style="padding:6px 0;"><a href="${loginUrl}" style="color:#6366f1;">${loginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">メールアドレス</td>
            <td style="padding:6px 0;font-weight:bold;">${toEmail}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0;color:#64748b;font-size:13px;">ご不明な点やお困りのことがございましたら、お気軽にご連絡ください。</p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis ECポータル" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject: '【Tiramis ECポータル】会員登録が完了しました',
    html: htmlWrapper(contentHtml),
    text: `${nameLabel} 様\n\nTiramis ECポータルにご登録いただき、誠にありがとうございます。\n\nログインURL: ${loginUrl}\nメールアドレス: ${toEmail}\n\nご不明な点はinfo@tiramis.co.jpまでお問い合わせください。`,
  });
};

// ─────────────────────────────────────────────────────────
// 4. 発注確定通知
// ─────────────────────────────────────────────────────────
export const sendOrderConfirmationEmail = async (
  toEmail: string,
  lastName: string,
  firstName: string,
  orders: { orderNo: string; title: string; totalAmount: number; status: string }[],
  myPageUrl: string,
) => {
  const subject =
    orders.length === 1
      ? `【Tiramis ECポータル】ご発注を承りました（${orders[0].orderNo}）`
      : `【Tiramis ECポータル】ご発注を承りました（${orders.length}件）`;

  const statusLabel: Record<string, string> = {
    PENDING_SUBMISSION: '入稿待ち',
    PENDING_PAYMENT: '入金待ち',
    PENDING_REVIEW: '審査待ち',
    CONFIRMED: '受注確定',
  };

  const orderRows = orders
    .map(
      (o) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 8px;font-size:13px;color:#1e293b;font-weight:bold;">${o.orderNo}</td>
      <td style="padding:12px 8px;font-size:13px;color:#1e293b;">${o.title}</td>
      <td style="padding:12px 8px;font-size:13px;color:#1e293b;text-align:right;">¥${o.totalAmount.toLocaleString('ja-JP')}</td>
      <td style="padding:12px 8px;font-size:13px;text-align:center;">
        <span style="background:#f0f9ff;color:#0284c7;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">${statusLabel[o.status] || o.status}</span>
      </td>
    </tr>`,
    )
    .join('');

  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${lastName} ${firstName} 様</p>
    <p style="margin:0 0 24px;">
      この度はご発注いただき、誠にありがとうございます。<br>
      以下の内容でご発注を承りました。
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 8px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 8px;font-size:12px;color:#64748b;text-align:left;font-weight:bold;">注文番号</th>
          <th style="padding:10px 8px;font-size:12px;color:#64748b;text-align:left;font-weight:bold;">件名</th>
          <th style="padding:10px 8px;font-size:12px;color:#64748b;text-align:right;font-weight:bold;">金額（税込）</th>
          <th style="padding:10px 8px;font-size:12px;color:#64748b;text-align:center;font-weight:bold;">ステータス</th>
        </tr>
      </thead>
      <tbody>${orderRows}</tbody>
    </table>

    <div style="text-align:center;margin:32px 0 24px;">
      <a href="${myPageUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">マイページで発注を確認する</a>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      ご不明な点やお困りのことがございましたら、お気軽にご連絡ください。<br>
      引き続き、何卒よろしくお願いいたします。
    </p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis ECポータル" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject,
    html: htmlWrapper(contentHtml),
    text: `${lastName} ${firstName} 様\n\nご発注いただき、誠にありがとうございます。\n\n${orders.map((o) => `注文番号: ${o.orderNo} / ${o.title} / ¥${o.totalAmount.toLocaleString('ja-JP')}`).join('\n')}\n\nマイページ: ${myPageUrl}\n\nご不明な点はinfo@tiramis.co.jpまでお問い合わせください。`,
  });
};

// ─────────────────────────────────────────────────────────
// 5. 発注審査完了（承認）通知
// ─────────────────────────────────────────────────────────
export const sendOrderApprovalEmail = async (
  toEmail: string,
  lastName: string,
  firstName: string,
  orderNo: string,
  orderTitle: string,
  myPageUrl: string,
) => {
  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${lastName} ${firstName} 様</p>
    <p style="margin:0 0 24px;">
      ご発注の審査が完了し、受注確定となりましたのでご連絡いたします。<br>
      引き続き、作業を進めてまいります。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 24px;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">発注情報</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:120px;">注文番号</td>
            <td style="padding:6px 0;font-weight:bold;">${orderNo}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">件名</td>
            <td style="padding:6px 0;">${orderTitle}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">ステータス</td>
            <td style="padding:6px 0;">
              <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">受注確定</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <div style="text-align:center;margin:32px 0 24px;">
      <a href="${myPageUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">マイページで確認する</a>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      ご不明な点がございましたら、お気軽にご連絡ください。<br>
      引き続き、何卒よろしくお願いいたします。
    </p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis ECポータル" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject: `【Tiramis ECポータル】ご発注の審査が完了しました（${orderNo}）`,
    html: htmlWrapper(contentHtml),
    text: `${lastName} ${firstName} 様\n\nご発注の審査が完了しました。\n\n注文番号: ${orderNo}\n件名: ${orderTitle}\nステータス: 受注確定\n\nマイページ: ${myPageUrl}\n\nご不明な点はinfo@tiramis.co.jpまでお問い合わせください。`,
  });
};

// ─────────────────────────────────────────────────────────
// 6. 社員パスワードリセット（ワンタイムリンク）
// ─────────────────────────────────────────────────────────
export const sendApplicantConfirmationEmail = async (
  toEmail: string,
  applicantName: string,
  language: string,
  interviewDate: string,
  interviewTime: string,
  meetUrl: string | null,
  jobCategoryName: string,
  managementToken?: string | null,
) => {
  const isEn = language === 'en';
  const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
  const manageUrl = managementToken ? `${siteUrl}/apply/manage/${managementToken}` : null;

  const meetSection = meetUrl
    ? `<tr>
        <td style="padding:6px 0;color:#64748b;width:160px;">${isEn ? 'Google Meet URL' : 'Google Meet URL'}</td>
        <td style="padding:6px 0;"><a href="${meetUrl}" style="color:#6366f1;font-weight:bold;">${isEn ? 'Join Meeting' : '面接に参加する'}</a></td>
       </tr>`
    : '';

  const manageSection = manageUrl
    ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin:24px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#0369a1;">
          ${isEn ? '📅 Need to change or cancel?' : '📅 面接の変更・キャンセル'}
        </p>
        <p style="margin:0 0 12px;font-size:13px;color:#475569;">
          ${isEn ? 'You can reschedule or cancel your interview using the link below.' : '以下のリンクから面接時間の変更やキャンセルが可能です。'}
        </p>
        <a href="${manageUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:bold;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none;">
          ${isEn ? 'Manage Interview' : '面接の変更・キャンセル'}
        </a>
      </div>`
    : '';

  const contentHtml = isEn
    ? `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">Dear ${applicantName},</p>
    <p style="margin:0 0 16px;">
      Thank you for your application. Your interview has been scheduled as follows.
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">Interview Details</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">Position</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Date</td>
            <td style="padding:6px 0;font-weight:bold;">${interviewDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Time</td>
            <td style="padding:6px 0;font-weight:bold;">${interviewTime}</td>
          </tr>
          ${meetSection}
        </table>
      </td></tr>
    </table>

    ${meetUrl ? `<div style="text-align:center;margin:32px 0 24px;">
      <a href="${meetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">Join Google Meet</a>
    </div>` : ''}

    ${manageSection}

    <p style="margin:0;color:#64748b;font-size:13px;">
      Please be on time for your interview. If you have any questions, please contact us at info@tiramis.co.jp.
    </p>
  `
    : `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${applicantName} 様</p>
    <p style="margin:0 0 16px;">
      この度はご応募いただき、誠にありがとうございます。<br>
      以下の内容で面接のご予約を承りました。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#475569;">面接情報</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">応募職種</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">面接日</td>
            <td style="padding:6px 0;font-weight:bold;">${interviewDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">面接時間</td>
            <td style="padding:6px 0;font-weight:bold;">${interviewTime}</td>
          </tr>
          ${meetSection}
        </table>
      </td></tr>
    </table>

    ${meetUrl ? `<div style="text-align:center;margin:32px 0 24px;">
      <a href="${meetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">Google Meetに参加する</a>
    </div>` : ''}

    ${manageSection}

    <p style="margin:0;color:#64748b;font-size:13px;">
      面接当日はお時間に余裕を持ってご参加ください。<br>
      ご不明な点がございましたら、info@tiramis.co.jp までお問い合わせください。
    </p>
  `;

  const subject = isEn
    ? '[Tiramis] Interview Appointment Confirmed'
    : '【Tiramis】面接のご予約を承りました';

  const manageText = manageUrl
    ? (isEn
      ? `\nTo change or cancel your interview: ${manageUrl}\n`
      : `\n面接の変更・キャンセル: ${manageUrl}\n`)
    : '';

  const textContent = isEn
    ? `Dear ${applicantName},\n\nThank you for your application. Your interview has been scheduled.\n\nPosition: ${jobCategoryName}\nDate: ${interviewDate}\nTime: ${interviewTime}\n${meetUrl ? `Google Meet: ${meetUrl}\n` : ''}${manageText}\nPlease be on time. Contact info@tiramis.co.jp for questions.`
    : `${applicantName} 様\n\nご応募いただきありがとうございます。面接のご予約を承りました。\n\n応募職種: ${jobCategoryName}\n面接日: ${interviewDate}\n面接時間: ${interviewTime}\n${meetUrl ? `Google Meet: ${meetUrl}\n` : ''}${manageText}\n面接当日はお時間に余裕を持ってご参加ください。`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject,
    html: htmlWrapper(contentHtml),
    text: textContent,
  });
};

// ─────────────────────────────────────────────────────────
// 8. 採用通知メール（応募者向け ja/en）
// ─────────────────────────────────────────────────────────
export const sendHiringNotificationEmail = async (
  toEmail: string,
  applicantName: string,
  language: string,
  jobCategoryName: string,
) => {
  const isEn = language === 'en';

  const contentHtml = isEn
    ? `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">Dear ${applicantName},</p>
    <p style="margin:0 0 16px;">
      Congratulations! We are pleased to inform you that you have been selected for the position below.
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#166534;">Hiring Decision</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">Position</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Result</td>
            <td style="padding:6px 0;">
              <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">Hired</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;">
      We will contact you shortly with further details about your onboarding and next steps.<br>
      Welcome to the team!
    </p>

    <p style="margin:0;color:#64748b;font-size:13px;">
      If you have any questions, please contact us at info@tiramis.co.jp.
    </p>
  `
    : `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${applicantName} 様</p>
    <p style="margin:0 0 16px;">
      この度は弊社の選考にご参加いただき、誠にありがとうございました。<br>
      選考の結果、下記の通り採用とさせていただくことになりました。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#166534;">採用結果</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">応募職種</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">選考結果</td>
            <td style="padding:6px 0;">
              <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">採用</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;">
      今後の入社手続きにつきましては、追ってご連絡いたします。<br>
      一緒に働けることを楽しみにしております。
    </p>

    <p style="margin:0;color:#64748b;font-size:13px;">
      ご不明な点がございましたら、info@tiramis.co.jp までお問い合わせください。
    </p>
  `;

  const subject = isEn
    ? "[Tiramis] Congratulations! You're Hired!"
    : '【Tiramis】採用のお知らせ';

  const textContent = isEn
    ? `Dear ${applicantName},\n\nCongratulations! You have been selected for the position of ${jobCategoryName}.\n\nWe will contact you shortly with further details.\nWelcome to the team!\n\nContact: info@tiramis.co.jp`
    : `${applicantName} 様\n\nこの度は弊社の選考にご参加いただき、ありがとうございました。\n選考の結果、採用とさせていただくことになりました。\n\n応募職種: ${jobCategoryName}\n\n今後の入社手続きにつきましては、追ってご連絡いたします。\nお問い合わせ: info@tiramis.co.jp`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject,
    html: htmlWrapper(contentHtml),
    text: textContent,
  });
};

// ─────────────────────────────────────────────────────────
// 6. 社員パスワードリセット（ワンタイムリンク）
// ─────────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  toEmail: string,
  lastName: string,
  firstName: string,
  resetUrl: string,
) => {
  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${lastName} ${firstName} さん</p>
    <p style="margin:0 0 16px;">
      パスワードリセットのリクエストを受け付けました。<br>
      下のボタンをクリックして、新しいパスワードを設定してください。
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">パスワードをリセットする</a>
    </div>

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#854d0e;">
        <strong>⚠ このリンクは1時間のみ有効で、1回しか使用できません。</strong><br>
        心当たりがない場合は、このメールを無視してください。パスワードは変更されません。
      </p>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      リンクが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください。<br>
      <span style="color:#6366f1;word-break:break-all;">${resetUrl}</span>
    </p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis PMS Pro" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject: '【Tiramis PMS Pro】パスワードリセットのご案内',
    html: htmlWrapper(contentHtml),
    text: `${lastName} ${firstName} さん\n\nパスワードリセットのリクエストを受け付けました。\n\n以下のURLをクリックして新しいパスワードを設定してください（1時間以内・1回限り有効）。\n\n${resetUrl}\n\n心当たりがない場合はこのメールを無視してください。`,
  });
};

// ─────────────────────────────────────────────────────────
// 9. 面接時間変更通知メール（応募者向け ja/en）
// ─────────────────────────────────────────────────────────
export const sendInterviewChangeEmail = async (
  toEmail: string,
  applicantName: string,
  language: string,
  newDate: string,
  newTime: string,
  meetUrl: string | null,
  jobCategoryName: string,
  managementToken: string,
) => {
  const isEn = language === 'en';
  const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
  const manageUrl = `${siteUrl}/apply/manage/${managementToken}`;

  const meetSection = meetUrl
    ? `<tr>
        <td style="padding:6px 0;color:#64748b;width:160px;">Google Meet URL</td>
        <td style="padding:6px 0;"><a href="${meetUrl}" style="color:#6366f1;font-weight:bold;">${isEn ? 'Join Meeting' : '面接に参加する'}</a></td>
       </tr>`
    : '';

  const contentHtml = isEn
    ? `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">Dear ${applicantName},</p>
    <p style="margin:0 0 16px;">
      Your interview has been rescheduled. Please see the updated details below.
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#92400e;">
          <span style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">Updated</span>
          &nbsp;New Interview Details
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">Position</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Date</td>
            <td style="padding:6px 0;font-weight:bold;">${newDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Time</td>
            <td style="padding:6px 0;font-weight:bold;">${newTime}</td>
          </tr>
          ${meetSection}
        </table>
      </td></tr>
    </table>

    ${meetUrl ? `<div style="text-align:center;margin:32px 0 24px;">
      <a href="${meetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">Join Google Meet</a>
    </div>` : ''}

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#0369a1;">📅 Need to make further changes?</p>
      <p style="margin:0 0 12px;font-size:13px;color:#475569;">You can reschedule or cancel your interview using the link below.</p>
      <a href="${manageUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:bold;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none;">Manage Interview</a>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      Please be on time for your interview. If you have any questions, please contact us at info@tiramis.co.jp.
    </p>
  `
    : `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${applicantName} 様</p>
    <p style="margin:0 0 16px;">
      面接日時の変更が完了しました。<br>
      新しい面接日時は以下の通りです。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#92400e;">
          <span style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">変更済み</span>
          &nbsp;新しい面接情報
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">応募職種</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">面接日</td>
            <td style="padding:6px 0;font-weight:bold;">${newDate}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">面接時間</td>
            <td style="padding:6px 0;font-weight:bold;">${newTime}</td>
          </tr>
          ${meetSection}
        </table>
      </td></tr>
    </table>

    ${meetUrl ? `<div style="text-align:center;margin:32px 0 24px;">
      <a href="${meetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">Google Meetに参加する</a>
    </div>` : ''}

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#0369a1;">📅 面接の変更・キャンセル</p>
      <p style="margin:0 0 12px;font-size:13px;color:#475569;">さらに変更が必要な場合は、以下のリンクから変更・キャンセルが可能です。</p>
      <a href="${manageUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:bold;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none;">面接の変更・キャンセル</a>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      面接当日はお時間に余裕を持ってご参加ください。<br>
      ご不明な点がございましたら、info@tiramis.co.jp までお問い合わせください。
    </p>
  `;

  const subject = isEn
    ? '[Tiramis] Interview Rescheduled'
    : '【Tiramis】面接日時が変更されました';

  const textContent = isEn
    ? `Dear ${applicantName},\n\nYour interview has been rescheduled.\n\nPosition: ${jobCategoryName}\nNew Date: ${newDate}\nNew Time: ${newTime}\n${meetUrl ? `Google Meet: ${meetUrl}\n` : ''}\nManage your interview: ${manageUrl}\n\nPlease be on time. Contact info@tiramis.co.jp for questions.`
    : `${applicantName} 様\n\n面接日時の変更が完了しました。\n\n応募職種: ${jobCategoryName}\n新しい面接日: ${newDate}\n新しい面接時間: ${newTime}\n${meetUrl ? `Google Meet: ${meetUrl}\n` : ''}\n面接の変更・キャンセル: ${manageUrl}\n\n面接当日はお時間に余裕を持ってご参加ください。`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject,
    html: htmlWrapper(contentHtml),
    text: textContent,
  });
};

// ─────────────────────────────────────────────────────────
// 10. 面接キャンセル確認メール（応募者向け ja/en）
// ─────────────────────────────────────────────────────────
export const sendInterviewCancelEmail = async (
  toEmail: string,
  applicantName: string,
  language: string,
  jobCategoryName: string,
) => {
  const isEn = language === 'en';

  const contentHtml = isEn
    ? `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">Dear ${applicantName},</p>
    <p style="margin:0 0 16px;">
      Your interview has been cancelled as requested.
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#991b1b;">
          <span style="background:#fee2e2;color:#991b1b;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">Cancelled</span>
          &nbsp;Interview Cancellation
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">Position</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">Status</td>
            <td style="padding:6px 0;">
              <span style="background:#fee2e2;color:#991b1b;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">Cancelled</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;">
      If you'd like to reapply in the future, please visit our application page.
    </p>

    <p style="margin:0;color:#64748b;font-size:13px;">
      If you have any questions, please contact us at info@tiramis.co.jp.
    </p>
  `
    : `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${applicantName} 様</p>
    <p style="margin:0 0 16px;">
      面接のキャンセルが完了しました。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#991b1b;">
          <span style="background:#fee2e2;color:#991b1b;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">キャンセル済み</span>
          &nbsp;面接キャンセル
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:160px;">応募職種</td>
            <td style="padding:6px 0;font-weight:bold;">${jobCategoryName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;">ステータス</td>
            <td style="padding:6px 0;">
              <span style="background:#fee2e2;color:#991b1b;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;">キャンセル済み</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;">
      今後改めてご応募いただける場合は、応募ページよりお手続きをお願いいたします。
    </p>

    <p style="margin:0;color:#64748b;font-size:13px;">
      ご不明な点がございましたら、info@tiramis.co.jp までお問い合わせください。
    </p>
  `;

  const subject = isEn
    ? '[Tiramis] Interview Cancelled'
    : '【Tiramis】面接キャンセルのお知らせ';

  const textContent = isEn
    ? `Dear ${applicantName},\n\nYour interview for the position of ${jobCategoryName} has been cancelled as requested.\n\nIf you'd like to reapply in the future, please visit our application page.\n\nContact: info@tiramis.co.jp`
    : `${applicantName} 様\n\n面接のキャンセルが完了しました。\n\n応募職種: ${jobCategoryName}\n\n今後改めてご応募いただける場合は、応募ページよりお手続きをお願いいたします。\nお問い合わせ: info@tiramis.co.jp`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject,
    html: htmlWrapper(contentHtml),
    text: textContent,
  });
};

// ─────────────────────────────────────────────────────────
// 12. Android内部テスト案内メール（配布員向け）
// ─────────────────────────────────────────────────────────
const ANDROID_OPT_IN_URL = 'https://play.google.com/apps/internaltest/4701181058894208136';

export const sendAndroidTestInviteEmail = async (
  toEmail: string,
  distributorName: string,
) => {
  const contentHtml = `
    <p style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 24px;">${distributorName} さん</p>
    <p style="margin:0 0 16px;">
      配布アプリ（Android版）の内部テストにご招待いたします。<br>
      以下の手順でアプリをインストールしてください。
    </p>

    <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin:24px 0;width:100%;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:14px;font-weight:bold;color:#166534;">
          📱 インストール手順
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#166534;font-weight:bold;width:32px;vertical-align:top;">1.</td>
            <td style="padding:6px 0;">このメールを受信した<strong>Googleアカウント</strong>でログインした状態で、下のボタンをタップしてください</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#166534;font-weight:bold;vertical-align:top;">2.</td>
            <td style="padding:6px 0;">「テスターになる」をタップして参加します</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#166534;font-weight:bold;vertical-align:top;">3.</td>
            <td style="padding:6px 0;">Google Play Storeからアプリをインストールできるようになります</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <div style="text-align:center;margin:32px 0;">
      <a href="${ANDROID_OPT_IN_URL}" style="display:inline-block;background:#16a34a;color:#ffffff;font-weight:bold;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">テストに参加する</a>
    </div>

    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#854d0e;">
        <strong>⚠ 注意事項</strong><br>
        ・このメールアドレス（${toEmail}）のGoogleアカウントでログインしている必要があります<br>
        ・テスト版のため、予期しない動作が発生する場合があります
      </p>
    </div>

    <p style="margin:0;color:#64748b;font-size:13px;">
      ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください。<br>
      <span style="color:#16a34a;word-break:break-all;">${ANDROID_OPT_IN_URL}</span>
    </p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Tiramis PMS Pro" <noreply@tiramis.co.jp>',
    to: toEmail,
    subject: '【Tiramis】配布アプリ（Android版）テスト参加のご案内',
    html: htmlWrapper(contentHtml),
    text: `${distributorName} さん\n\n配布アプリ（Android版）の内部テストにご招待いたします。\n\n【インストール手順】\n1. このメールを受信したGoogleアカウントでログインした状態で、以下のURLにアクセスしてください\n2. 「テスターになる」をタップして参加します\n3. Google Play Storeからアプリをインストールできるようになります\n\nテスト参加URL:\n${ANDROID_OPT_IN_URL}\n\n※ このメールアドレス（${toEmail}）のGoogleアカウントでログインしている必要があります\n※ テスト版のため、予期しない動作が発生する場合があります`,
  });
};
