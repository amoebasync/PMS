import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { getAdminActorInfo, getIpAddress, writeAuditLog } from '@/lib/audit';

/**
 * POST /api/fraud-analysis/[id]/review — レビュー結果を保存
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { result, note } = body;

    if (!['FALSE_POSITIVE', 'SUSPICIOUS', 'CONFIRMED_FRAUD'].includes(result)) {
      return NextResponse.json({ error: '無効なレビュー結果です' }, { status: 400 });
    }

    const { actorId } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const updated = await prisma.fraudAnalysis.update({
      where: { id: parseInt(id) },
      data: {
        reviewResult: result,
        reviewNote: note || null,
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName: (await getAdminActorInfo()).actorName,
      action: 'UPDATE',
      targetModel: 'FraudAnalysis',
      targetId: updated.id,
      description: `不正検知レビュー: ${result}${note ? ` — ${note}` : ''}`,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, reviewResult: result });
  } catch (err) {
    console.error('Fraud Review Error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
