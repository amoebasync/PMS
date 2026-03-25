import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// チェック周期プリセット（日数）
// -1 = 不要, 0は使わない
export const INSPECTION_INTERVALS = [
  { value: 1, label: '毎日', labelEn: 'Daily' },
  { value: 3, label: '3日', labelEn: '3 days' },
  { value: 7, label: '1週間', labelEn: '1 week' },
  { value: 14, label: '2週間', labelEn: '2 weeks' },
  { value: 30, label: '1ヶ月', labelEn: '1 month' },
  { value: 60, label: '2ヶ月', labelEn: '2 months' },
  { value: 90, label: '3ヶ月', labelEn: '3 months' },
  { value: 180, label: '半年', labelEn: '6 months' },
  { value: 365, label: '1年', labelEn: '1 year' },
  { value: -1, label: '不要', labelEn: 'Not required' },
];

type InspectionStatus = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NEVER' | 'NOT_REQUIRED';

function getStatus(lastInspectedAt: Date | null, nextInspectionDue: Date | null, inspectionInterval: number | null): InspectionStatus {
  if (inspectionInterval === -1) return 'NOT_REQUIRED';
  if (!lastInspectedAt) return 'NEVER';
  if (!nextInspectionDue) return 'NEVER';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextInspectionDue);
  due.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= 7) return 'DUE_SOON';
  return 'OK';
}

// GET /api/distributors/inspection-status
export async function GET(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const sp = request.nextUrl.searchParams;
    const branchId = sp.get('branchId') ? parseInt(sp.get('branchId')!) : null;
    const statusFilter = sp.get('status') as InspectionStatus | null;

    const defaultIntervalSetting = await prisma.systemSetting.findUnique({
      where: { key: 'inspectionIntervalDays' },
    });
    const defaultInterval = parseInt(defaultIntervalSetting?.value || '30');

    const where: any = { leaveDate: null };
    if (branchId) where.branchId = branchId;

    const distributors = await prisma.flyerDistributor.findMany({
      where,
      select: {
        id: true,
        name: true,
        staffId: true,
        branchId: true,
        branch: { select: { nameJa: true } },
        lastInspectedAt: true,
        lastInspectionType: true,
        nextInspectionDue: true,
        inspectionInterval: true,
        rank: true,
      },
      orderBy: { name: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = distributors.map(d => {
      const interval = d.inspectionInterval ?? defaultInterval;
      const status = getStatus(d.lastInspectedAt, d.nextInspectionDue, d.inspectionInterval);

      let daysSinceLastCheck: number | null = null;
      if (d.lastInspectedAt) {
        daysSinceLastCheck = Math.floor((today.getTime() - new Date(d.lastInspectedAt).getTime()) / (1000 * 60 * 60 * 24));
      }

      let daysUntilDue: number | null = null;
      if (d.nextInspectionDue) {
        const due = new Date(d.nextInspectionDue);
        due.setHours(0, 0, 0, 0);
        daysUntilDue = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: d.id,
        name: d.name,
        staffId: d.staffId,
        branchName: d.branch?.nameJa || null,
        rank: d.rank,
        lastInspectedAt: d.lastInspectedAt,
        lastInspectionType: d.lastInspectionType,
        nextInspectionDue: d.nextInspectionDue,
        inspectionInterval: interval,
        daysSinceLastCheck,
        daysUntilDue,
        status,
      };
    });

    // Filter by status
    const filtered = statusFilter
      ? result.filter(d => d.status === statusFilter)
      : result;

    // Sort: OVERDUE first, then NEVER, DUE_SOON, OK, NOT_REQUIRED
    const ORDER: Record<InspectionStatus, number> = { OVERDUE: 0, NEVER: 1, DUE_SOON: 2, OK: 3, NOT_REQUIRED: 4 };
    filtered.sort((a, b) => {
      const orderDiff = ORDER[a.status] - ORDER[b.status];
      if (orderDiff !== 0) return orderDiff;
      // Within same status, sort by days since last check (descending)
      return (b.daysSinceLastCheck ?? 9999) - (a.daysSinceLastCheck ?? 9999);
    });

    // Summary counts
    const summary = {
      overdue: result.filter(d => d.status === 'OVERDUE').length,
      dueSoon: result.filter(d => d.status === 'DUE_SOON').length,
      never: result.filter(d => d.status === 'NEVER').length,
      ok: result.filter(d => d.status === 'OK').length,
      notRequired: result.filter(d => d.status === 'NOT_REQUIRED').length,
      total: result.length,
    };

    return NextResponse.json({ data: filtered, summary });
  } catch (err) {
    console.error('Inspection status error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
