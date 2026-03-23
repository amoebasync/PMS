import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { pushMessage, isLineConfigured } from '@/lib/line';

// POST /api/inspections/[id]/finish
// 現地確認を完了（サマリー自動計算）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    if (inspection.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: '完了できるのはIN_PROGRESSステータスの現地確認のみです' }, { status: 400 });
    }

    // チェックポイント集計
    const checkpoints = await prisma.inspectionCheckpoint.findMany({
      where: { inspectionId },
    });

    const totalCheckpoints = checkpoints.length;
    const confirmedCount = checkpoints.filter(cp => cp.result === 'CONFIRMED').length;
    const notFoundCount = checkpoints.filter(cp => cp.result === 'NOT_FOUND').length;

    // 禁止物件チェック集計
    const prohibitedChecks = await prisma.inspectionProhibitedCheck.findMany({
      where: { inspectionId },
    });

    const totalProhibited = prohibitedChecks.length;
    const compliantCount = prohibitedChecks.filter(pc => pc.result === 'COMPLIANT').length;
    const violationCount = prohibitedChecks.filter(pc => pc.result === 'VIOLATION').length;

    // レート計算
    const confirmationRate = totalCheckpoints > 0
      ? confirmedCount / totalCheckpoints
      : null;

    const complianceRate = (compliantCount + violationCount) > 0
      ? compliantCount / (compliantCount + violationCount)
      : null;

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // FieldInspection更新
      const updated = await tx.fieldInspection.update({
        where: { id: inspectionId },
        data: {
          coverageChecked: totalCheckpoints,
          coverageFound: confirmedCount,
          prohibitedTotal: totalProhibited,
          prohibitedViolations: violationCount,
          confirmationRate,
          complianceRate,
          status: 'COMPLETED',
          completedAt: now,
        },
        include: {
          distributor: { select: { id: true, name: true, staffId: true } },
          inspector: { select: { id: true, lastNameJa: true, firstNameJa: true } },
          schedule: {
            select: {
              area: {
                include: {
                  prefecture: { select: { name: true } },
                  city: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      // InspectionSession終了
      await tx.inspectionSession.updateMany({
        where: { inspectionId },
        data: { finishedAt: now },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'STATUS_CHANGE',
        targetModel: 'FieldInspection',
        targetId: inspectionId,
        beforeData: inspection as unknown as Record<string, unknown>,
        afterData: updated as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `現地確認を完了（ID: ${inspectionId}, 確認率: ${confirmationRate != null ? (confirmationRate * 100).toFixed(1) : '-'}%, 遵守率: ${complianceRate != null ? (complianceRate * 100).toFixed(1) : '-'}%）`,
        tx,
      });

      return {
        ...updated,
        summary: {
          totalCheckpoints,
          confirmed: confirmedCount,
          notFound: notFoundCount,
          totalProhibited,
          compliant: compliantCount,
          violations: violationCount,
          confirmationRate,
          complianceRate,
        },
      };
    });

    // LINE notification (fire-and-forget)
    try {
      if (isLineConfigured()) {
        const groupSetting = await prisma.systemSetting.findUnique({
          where: { key: 'lineInspectionNotificationGroupId' },
        });
        if (groupSetting?.value) {
          const categoryLabel = result.category === 'CHECK' ? 'チェック' : '指導';
          const distributorName = result.distributor?.name || '-';
          const staffId = result.distributor?.staffId || '';
          const inspectorName = result.inspector
            ? `${result.inspector.lastNameJa}${result.inspector.firstNameJa}`
            : '-';
          const area = (result as any).schedule?.area;
          const areaName = area
            ? `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`
            : '-';
          const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
          const dateStr = `${jstNow.getFullYear()}/${String(jstNow.getMonth() + 1).padStart(2, '0')}/${String(jstNow.getDate()).padStart(2, '0')} ${String(jstNow.getHours()).padStart(2, '0')}:${String(jstNow.getMinutes()).padStart(2, '0')}`;

          let resultsText = '';
          if (result.category === 'CHECK') {
            const confRate = confirmationRate != null ? `${(confirmationRate * 100).toFixed(1)}%` : '-';
            const compRate = complianceRate != null ? `${(complianceRate * 100).toFixed(1)}%` : '-';
            resultsText = [
              `確認率: ${confRate}`,
              `遵守率: ${compRate}`,
              `チェックポイント: ${confirmedCount}/${totalCheckpoints}件 確認`,
              notFoundCount > 0 ? `未発見: ${notFoundCount}件` : null,
              violationCount > 0 ? `禁止物件違反: ${violationCount}/${totalProhibited}件` : null,
            ].filter(Boolean).join('\n');
          } else {
            // GUIDANCE
            const ratingLabels: [string, string | null | undefined][] = [
              ['配布速度', result.distributionSpeed],
              ['シール遵守', result.stickerCompliance],
              ['禁止物件遵守', result.prohibitedCompliance],
              ['地図理解', result.mapComprehension],
              ['勤務態度', result.workAttitude],
            ];
            resultsText = ratingLabels
              .map(([label, val]) => `${label}: ${val || '-'}`)
              .join('\n');
          }

          const messageText = [
            `【巡回完了】${categoryLabel}`,
            `━━━━━━━━━━━━━━`,
            `配布員: ${distributorName}${staffId ? ` (${staffId})` : ''}`,
            `エリア: ${areaName}`,
            `巡回員: ${inspectorName}`,
            ``,
            `■ 結果`,
            resultsText,
            result.note ? `\n■ 備考\n${result.note}` : '',
            `━━━━━━━━━━━━━━`,
            dateStr,
          ].filter(s => s !== undefined).join('\n');

          await pushMessage(groupSetting.value, [{ type: 'text', text: messageText }]);
        }
      }
    } catch (lineErr) {
      console.error('LINE notification error (non-fatal):', lineErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/inspections/[id]/finish error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
