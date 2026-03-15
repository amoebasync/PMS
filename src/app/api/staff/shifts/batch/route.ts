import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { sendShiftNotification, sendShiftCancelNotification } from '@/lib/slack';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { addDates, removeDateIds, notes, weekStart, weekEnd } = await request.json() as {
      addDates: string[];      // ["2026-03-16", "2026-03-18", ...]
      removeDateIds: number[]; // shift IDs to delete
      notes: Record<string, string>; // { "2026-03-16": "午後から" }
      weekStart: string;       // "2026-03-16" (月曜)
      weekEnd: string;         // "2026-03-22" (日曜)
    };

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const hour = now.getHours();
    const minAllowedDate = new Date(today);
    minAllowedDate.setDate(minAllowedDate.getDate() + (hour < 9 ? 1 : 2));

    const errors: string[] = [];
    const createdDates: string[] = [];
    const cancelledDates: string[] = [];

    // 追加処理
    if (addDates && addDates.length > 0) {
      for (const dateStr of addDates) {
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);

        if (targetDate < minAllowedDate) {
          const msg = hour < 9
            ? '翌日以降のシフトのみ申請できます'
            : '9時以降は明後日以降のシフトのみ申請できます';
          errors.push(`${dateStr}: ${msg}`);
          continue;
        }

        try {
          await prisma.distributorShift.create({
            data: {
              distributorId: distributor.id,
              date: new Date(dateStr),
              note: notes?.[dateStr] || null,
              status: 'WORKING',
            },
          });
          createdDates.push(dateStr);
        } catch (err: any) {
          if (err?.code === 'P2002') {
            errors.push(`${dateStr}: すでに申請済みです`);
          } else {
            errors.push(`${dateStr}: 登録に失敗しました`);
          }
        }
      }
    }

    // 削除処理
    if (removeDateIds && removeDateIds.length > 0) {
      for (const id of removeDateIds) {
        try {
          const shift = await prisma.distributorShift.findUnique({ where: { id } });
          if (!shift || shift.distributorId !== distributor.id) {
            errors.push(`シフトID ${id}: 見つかりません`);
            continue;
          }
          const shiftDate = new Date(shift.date);
          shiftDate.setHours(0, 0, 0, 0);

          if (shiftDate.getTime() === today.getTime()) {
            errors.push('当日のシフトはキャンセルできません');
            continue;
          }
          if (shiftDate.getTime() === tomorrow.getTime() && hour >= 9) {
            errors.push('午前9時以降は翌日のシフトをキャンセルできません');
            continue;
          }

          await prisma.distributorShift.delete({ where: { id } });
          const d = shiftDate;
          cancelledDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        } catch {
          errors.push(`シフトの取消に失敗しました`);
        }
      }
    }

    // 支店名取得
    let branchName = '未設定';
    if (distributor.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: distributor.branchId },
        select: { nameJa: true },
      });
      if (branch) branchName = branch.nameJa;
    }

    // Slack 通知（追加分）
    if (createdDates.length > 0 && weekStart && weekEnd) {
      // 週の全日を生成して、出勤/非出勤をマッピング
      const ws = new Date(weekStart + 'T00:00:00');
      const allDays: { date: string; working: boolean; note?: string | null }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // 既存シフト + 今回追加分を確認
        const existingShift = await prisma.distributorShift.findFirst({
          where: { distributorId: distributor.id, date: new Date(ds) },
        });
        allDays.push({
          date: ds,
          working: !!existingShift,
          note: existingShift?.note,
        });
      }

      sendShiftNotification({
        distributorName: distributor.name,
        branchName,
        weekStart,
        weekEnd,
        days: allDays,
      }).catch(err => console.error('Slack shift notification error:', err));
    }

    // Slack 通知（取消分）
    if (cancelledDates.length > 0) {
      sendShiftCancelNotification({
        distributorName: distributor.name,
        branchName,
        cancelledDates,
      }).catch(err => console.error('Slack cancel notification error:', err));
    }

    return NextResponse.json({
      created: createdDates.length,
      cancelled: cancelledDates.length,
      errors,
    });
  } catch (error) {
    console.error('Distributor Shifts Batch Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
