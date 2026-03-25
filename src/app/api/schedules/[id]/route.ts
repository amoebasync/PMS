import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { requireAdminSession } from '@/lib/adminAuth';
import { ensureShiftExists } from '@/lib/autoShift';


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();

    const data: any = {};
    if (body.remarks !== undefined) data.remarks = body.remarks;
    if (body.areaId !== undefined) data.areaId = body.areaId ? parseInt(body.areaId) : null;
    if (body.branchId !== undefined) data.branchId = body.branchId ? parseInt(body.branchId) : null;
    if (body.distributorId !== undefined) data.distributorId = body.distributorId ? parseInt(body.distributorId) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.date !== undefined) data.date = new Date(body.date);

    // コンプライアンスチェックフィールド
    const checkFields = ['checkFlyerPhoto', 'checkAppOperation', 'checkGps', 'checkMapPhoto'] as const;
    let hasCheckChange = false;
    for (const field of checkFields) {
      if (body[field] !== undefined) {
        data[field] = Boolean(body[field]);
        hasCheckChange = true;
      }
    }
    // GPS確認のOK/NG結果とコメント
    if (body.checkGpsResult !== undefined) {
      data.checkGpsResult = body.checkGpsResult; // 'OK' | 'NG' | null
      hasCheckChange = true;
    }
    if (body.checkGpsComment !== undefined) {
      data.checkGpsComment = body.checkGpsComment || null;
      hasCheckChange = true;
    }

    // チェック変更があれば確認者と日時を自動設定
    if (hasCheckChange) {
      try {
        const { actorId } = await getAdminActorInfo();
        data.checkedById = actorId;
        data.checkedAt = new Date();
      } catch {
        // 認証情報取得失敗時もチェック更新は続行
      }
    }

    const scheduleId = parseInt(id);

    // 監査ログ用のbefore取得（チェック変更時のみ）
    let beforeData = null;
    if (hasCheckChange) {
      beforeData = await prisma.distributionSchedule.findUnique({
        where: { id: scheduleId },
        select: { checkFlyerPhoto: true, checkAppOperation: true, checkGps: true, checkMapPhoto: true, checkedById: true, checkedAt: true }
      });
    }

    // アイテムの実績枚数更新
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        if (item.id && item.actualCount !== undefined) {
          await prisma.distributionItem.update({
            where: { id: item.id },
            data: { actualCount: parseInt(item.actualCount) || 0 },
          });
        }
      }
    }

    const updatedSchedule = await prisma.distributionSchedule.update({
      where: { id: scheduleId },
      data,
      include: {
        checkedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        items: { orderBy: { slotIndex: 'asc' } },
      }
    });

    // 配布員アサイン時にシフトを自動作成
    if (body.distributorId && updatedSchedule.date) {
      try {
        await ensureShiftExists(parseInt(body.distributorId), updatedSchedule.date);
      } catch (e) {
        console.error('Auto-shift creation failed:', e);
      }
    }

    // 監査ログ記録（チェック変更時のみ）
    if (hasCheckChange && beforeData) {
      try {
        const { actorId, actorName } = await getAdminActorInfo();
        const ip = getIpAddress(request);
        await writeAuditLog({
          actorType: 'EMPLOYEE',
          action: 'UPDATE',
          targetModel: 'DistributionSchedule',
          targetId: scheduleId,
          actorId,
          actorName,
          ipAddress: ip,
          beforeData,
          afterData: {
            checkFlyerPhoto: updatedSchedule.checkFlyerPhoto,
            checkAppOperation: updatedSchedule.checkAppOperation,
            checkGps: updatedSchedule.checkGps,
            checkMapPhoto: updatedSchedule.checkMapPhoto,
            checkedById: updatedSchedule.checkedById,
            checkedAt: updatedSchedule.checkedAt,
          },
        });
      } catch (e) {
        console.error('Failed to write audit log:', e);
      }
    }

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error('Failed to update schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const scheduleId = parseInt(id);

    await prisma.$transaction(async (tx) => {
      // FK制約のある関連レコードのscheduleIdをnullに（onDelete: SetNull がDBに反映されていない場合の安全策）
      await tx.task.updateMany({ where: { scheduleId }, data: { scheduleId: null } });
      await tx.taskTemplate.updateMany({ where: { scheduleId }, data: { scheduleId: null } });
      await tx.complaint.updateMany({ where: { scheduleId }, data: { scheduleId: null } });
      // Cascade対象（items, sessions, notifications）はDB側で自動削除
      await tx.distributionSchedule.delete({ where: { id: scheduleId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete schedule:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
