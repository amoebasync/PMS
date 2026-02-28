import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getIpAddress } from '@/lib/audit';

// GET /api/complaints/[id]/responses
// クレーム対応履歴一覧
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    // クレーム存在確認
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true },
    });
    if (!complaint) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    const responses = await prisma.complaintResponse.findMany({
      where: { complaintId },
      include: {
        responder: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error('Complaint Responses List Error:', error);
    return NextResponse.json({ error: '対応履歴の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/complaints/[id]/responses
// クレーム対応履歴追加
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '対応内容を入力してください' }, { status: 400 });
    }

    const ip = getIpAddress(request);

    // セッションから社員情報を取得（getAdminActorInfoと同じパターン）
    const empId = parseInt(sessionId);
    const employee = !isNaN(empId)
      ? await prisma.employee.findFirst({
          where: { id: empId },
          select: { id: true, lastNameJa: true, firstNameJa: true },
        })
      : null;

    const actorId = employee?.id ?? null;
    const actorName = employee
      ? `${employee.lastNameJa} ${employee.firstNameJa}`
      : null;

    // クレーム存在確認と現在のステータス取得
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, title: true, status: true },
    });
    if (!complaint) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 対応履歴を作成
      const response = await tx.complaintResponse.create({
        data: {
          complaintId,
          responderId: actorId,
          content: content.trim(),
        },
        include: {
          responder: {
            select: { id: true, lastNameJa: true, firstNameJa: true },
          },
        },
      });

      // 未対応の場合は自動的に対応中に変更
      let statusChanged = false;
      if (complaint.status === 'UNRESOLVED') {
        await tx.complaint.update({
          where: { id: complaintId },
          data: { status: 'IN_PROGRESS' },
        });
        statusChanged = true;
      }

      // 対応履歴作成の監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'ComplaintResponse',
        targetId: response.id,
        afterData: response as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `クレーム「${complaint.title}」に対応履歴を追加`,
        tx,
      });

      // ステータス変更があった場合の監査ログ
      if (statusChanged) {
        await writeAuditLog({
          actorType: 'EMPLOYEE',
          actorId,
          actorName,
          action: 'STATUS_CHANGE',
          targetModel: 'Complaint',
          targetId: complaintId,
          beforeData: { status: 'UNRESOLVED' },
          afterData: { status: 'IN_PROGRESS' },
          ipAddress: ip,
          description: `クレーム「${complaint.title}」のステータスを自動変更（UNRESOLVED -> IN_PROGRESS）`,
          tx,
        });
      }

      return { response, statusChanged };
    });

    return NextResponse.json(
      {
        ...result.response,
        statusChanged: result.statusChanged,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Complaint Response Create Error:', error);
    return NextResponse.json({ error: '対応履歴の追加に失敗しました' }, { status: 500 });
  }
}
