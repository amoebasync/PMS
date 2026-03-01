import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import crypto from 'crypto';

function buildInitialPassword(birthday: string): string {
  const d = new Date(birthday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return crypto.createHash('sha256').update(`${y}${m}${day}`).digest('hex');
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
    const { birthday, branchId, staffId, gender } = body;

    if (!birthday) {
      return NextResponse.json({ error: '生年月日は必須です' }, { status: 400 });
    }

    if (!branchId) {
      return NextResponse.json({ error: '所属支店は必須です' }, { status: 400 });
    }

    // 応募者を取得
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 初期パスワードを生成（birthday: YYYY-MM-DD）
    const passwordHash = buildInitialPassword(birthday);

    const newDistributor = await prisma.$transaction(async (tx) => {
      const distributor = await tx.flyerDistributor.create({
        data: {
          branchId: parseInt(branchId, 10),
          countryId: applicant.countryId ?? null,
          visaTypeId: applicant.visaTypeId ?? null,
          staffId: staffId || null,
          name: applicant.name,
          phone: applicant.phone ?? null,
          email: applicant.email,
          birthday: new Date(birthday),
          gender: gender || null,
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
        description: `応募者「${applicant.name}」を配布員として登録（配布員ID: ${distributor.id}）`,
        ipAddress: ip,
        tx,
      });

      return distributor;
    });

    return NextResponse.json({
      success: true,
      distributorId: newDistributor.id,
      name: newDistributor.name,
    });
  } catch (error: any) {
    console.error('Register As Distributor Error:', error);
    // メールアドレス重複エラーを判定
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'このメールアドレスの配布員は既に登録されています' }, { status: 409 });
    }
    return NextResponse.json({ error: '配布員登録に失敗しました' }, { status: 500 });
  }
}
