import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendDistributorWelcomeEmail } from '@/lib/mailer';
import { isPostingSystemSyncConfigured, syncStaffToPostingSystem } from '@/lib/posting-system-sync';
import { hashPassword, birthdayToYYYYMMDD } from '@/lib/password';
import { isDocusealConfigured, createContractSubmission } from '@/lib/docuseal';

async function buildInitialPassword(birthday: Date): Promise<string> {
  return hashPassword(birthdayToYYYYMMDD(birthday));
}

// POST /api/applicants/[id]/register-as-distributor
// 管理者: 採用応募者を配布員として登録
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const applicantId = parseInt(id);
    const body = await request.json();
    const { branchId, staffId, sendWelcomeEmail = false, syncToPostingSystem = true, sendContract = false } = body;

    if (!branchId) {
      return NextResponse.json({ error: '所属支店は必須です' }, { status: 400 });
    }

    // 応募者を取得（生年月日・性別も応募者情報から引き継ぐ）
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    if (!applicant.birthday) {
      return NextResponse.json({ error: '応募者の生年月日が登録されていません' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 初期パスワードを生成（応募者の生年月日から）
    const passwordHash = await buildInitialPassword(applicant.birthday);

    const newDistributor = await prisma.$transaction(async (tx) => {
      let resolvedStaffId = staffId;

      if (!resolvedStaffId) {
        // staffIdSeq をインクリメントして新しいスタッフIDを生成
        const branch = await tx.branch.update({
          where: { id: parseInt(branchId, 10) },
          data: { staffIdSeq: { increment: 1 } },
          select: { prefix: true, staffIdSeq: true },
        });

        const prefix = branch.prefix || '';
        if (prefix) {
          resolvedStaffId = `${prefix}${String(branch.staffIdSeq).padStart(3, '0')}`;
        } else {
          // プレフィックス未設定のフォールバック
          resolvedStaffId = `B${String(parseInt(branchId, 10)).padStart(2, '0')}-${String(branch.staffIdSeq).padStart(3, '0')}`;
        }
      }

      const distributor = await tx.flyerDistributor.create({
        data: {
          branchId: parseInt(branchId, 10),
          countryId: applicant.countryId ?? null,
          visaTypeId: applicant.visaTypeId ?? null,
          staffId: resolvedStaffId,
          name: applicant.name,
          phone: applicant.phone ?? null,
          email: applicant.email,
          birthday: applicant.birthday,
          gender: (applicant.gender && applicant.gender !== 'unknown') ? applicant.gender : null,
          postalCode: applicant.postalCode ?? null,
          address: applicant.address ?? null,
          buildingName: applicant.building ?? null,
          passwordHash,
          isPasswordTemp: true,
          attendanceCount: 0,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'FlyerDistributor',
        targetId: distributor.id,
        afterData: { ...distributor, passwordHash: '[REDACTED]' } as unknown as Record<string, unknown>,
        description: `応募者「${applicant.name}」を配布員として登録（スタッフID: ${resolvedStaffId}）`,
        ipAddress: ip,
        tx,
      });

      return distributor;
    });

    // Posting System に同期（fire-and-forget）
    if (syncToPostingSystem && isPostingSystemSyncConfigured()) {
      const branch = await prisma.branch.findUnique({
        where: { id: parseInt(branchId, 10) },
        select: { prefix: true },
      });
      syncStaffToPostingSystem({
        staffCd: newDistributor.staffId,
        staffName: newDistributor.name,
        staffTel: newDistributor.phone || '',
        shopCd: branch?.prefix || '',
        joinDate: new Date().toISOString().slice(0, 10),
      }).catch(err => console.error('[PostingSync] Failed to sync new distributor:', err));
    }

    // 案内メール送信
    let emailSent = false;
    if (sendWelcomeEmail && applicant.email) {
      const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
      const loginUrl = `${siteUrl}/staff/login`;
      const birthday = applicant.birthday!;
      const birthdayPassword = `${birthday.getFullYear()}${String(birthday.getMonth() + 1).padStart(2, '0')}${String(birthday.getDate()).padStart(2, '0')}`;

      try {
        await sendDistributorWelcomeEmail(
          applicant.email,
          applicant.name,
          applicant.language || 'ja',
          newDistributor.staffId,
          birthdayPassword,
          loginUrl,
        );
        emailSent = true;
      } catch (err) {
        console.error('Distributor welcome email failed:', err);
      }
    }

    // 業務委託契約書送信（DocuSeal）
    let contractSent = false;
    if (sendContract && applicant.email && isDocusealConfigured()) {
      try {
        const submission = await createContractSubmission({
          email: applicant.email,
          name: applicant.name,
          externalId: String(newDistributor.id),
          sendEmail: true,
        });
        const submitter = submission.submitters?.[0];
        await prisma.flyerDistributor.update({
          where: { id: newDistributor.id },
          data: {
            contractStatus: 'SENT',
            docusealSubmissionId: submission.id,
            docusealSubmitterId: submitter?.id || null,
          },
        });
        contractSent = true;
      } catch (err) {
        console.error('Contract send error during distributor registration:', err);
      }
    }

    return NextResponse.json({
      success: true,
      distributorId: newDistributor.id,
      staffId: newDistributor.staffId,
      name: newDistributor.name,
      emailSent,
      contractSent,
    });
  } catch (error: any) {
    console.error('Register As Distributor Error:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'このメールアドレスまたはスタッフIDの配布員は既に登録されています' }, { status: 409 });
    }
    return NextResponse.json({ error: '配布員登録に失敗しました' }, { status: 500 });
  }
}
