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

    // LINE Flex Message notification (fire-and-forget)
    try {
      if (isLineConfigured()) {
        const groupSetting = await prisma.systemSetting.findUnique({
          where: { key: 'lineInspectionNotificationGroupId' },
        });
        if (groupSetting?.value) {
          const categoryLabel = result.category === 'CHECK' ? 'チェックレポート' : '指導レポート';
          const categoryEmoji = '📋';
          const distributorName = result.distributor?.name || '-';
          const staffId = result.distributor?.staffId || '';
          const inspectorName = result.inspector
            ? `${result.inspector.lastNameJa}${result.inspector.firstNameJa}`
            : '-';
          const area = (result as any).schedule?.area;
          const areaName = area
            ? `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`
            : '-';
          const jstNow = now.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Build Mapbox static map URL with checkpoint pins
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
          let mapImageUrl = '';
          if (mapboxToken) {
            // Calculate center from area polygon
            let centerLng = 139.7;
            let centerLat = 35.7;
            if (area?.boundary_geojson) {
              try {
                const geojson = typeof area.boundary_geojson === 'string'
                  ? JSON.parse(area.boundary_geojson)
                  : area.boundary_geojson;
                const coords: number[][] = geojson.type === 'Polygon'
                  ? geojson.coordinates[0]
                  : geojson.type === 'MultiPolygon'
                    ? geojson.coordinates.flat(2)
                    : geojson.coordinates?.[0] || [];
                if (coords.length > 0) {
                  const sumLng = coords.reduce((s: number, c: number[]) => s + c[0], 0);
                  const sumLat = coords.reduce((s: number, c: number[]) => s + c[1], 0);
                  centerLng = sumLng / coords.length;
                  centerLat = sumLat / coords.length;
                }
              } catch {}
            }

            // Build pin markers for each checkpoint
            const pins = checkpoints
              .filter(cp => cp.targetLat != null && cp.targetLng != null)
              .map(cp => {
                if (cp.result === 'CONFIRMED') {
                  return `pin-l+22c55e(${cp.targetLng},${cp.targetLat})`;
                } else if (cp.result === 'NOT_FOUND') {
                  return `pin-l-x+e74c3c(${cp.targetLng},${cp.targetLat})`;
                } else {
                  return `pin-l+95a5a6(${cp.targetLng},${cp.targetLat})`;
                }
              });

            const overlay = pins.length > 0 ? pins.join(',') : `pin-s+999999(${centerLng},${centerLat})`;
            mapImageUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/${centerLng},${centerLat},14.5,0/600x400@2x?access_token=${mapboxToken}`;
          }

          // Translate note if mostly English
          let noteSection: any[] = [];
          if (result.note) {
            const asciiLetters = (result.note.match(/[a-zA-Z]/g) || []).length;
            const totalChars = result.note.replace(/\s/g, '').length;
            const isEnglish = totalChars > 0 && asciiLetters / totalChars > 0.5;

            let translatedNote = '';
            if (isEnglish && process.env.ANTHROPIC_API_KEY) {
              try {
                const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                  },
                  body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    system: 'Translate the following English text to Japanese. Return only the translation.',
                    messages: [{ role: 'user', content: result.note }],
                  }),
                });
                if (anthropicRes.ok) {
                  const data = await anthropicRes.json();
                  translatedNote = data.content?.[0]?.text || '';
                }
              } catch {}
            }

            noteSection = [
              { type: 'separator', margin: 'lg' },
              {
                type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm',
                contents: [
                  { type: 'text', text: '📝 メモ', size: 'sm', color: '#555555', weight: 'bold' },
                  { type: 'text', text: result.note, size: 'sm', color: '#333333', wrap: true },
                  ...(translatedNote ? [{
                    type: 'text' as const,
                    text: `(翻訳) ${translatedNote}`,
                    size: 'sm' as const,
                    color: '#666666',
                    wrap: true,
                    margin: 'sm' as const,
                    style: 'italic' as const,
                  }] : []),
                ],
              },
            ];
          }

          // Confirmation/compliance rate display
          const confRateStr = confirmationRate != null ? `${(confirmationRate * 100).toFixed(0)}%` : '-';
          const compRateStr = complianceRate != null ? `${(complianceRate * 100).toFixed(0)}%` : '-';
          const unableCount = totalCheckpoints - confirmedCount - notFoundCount;

          // Status color
          const headerColor = result.category === 'CHECK' ? '#22c55e' : '#3b82f6';

          const flexMessage = {
            type: 'flex',
            altText: `${categoryEmoji} ${categoryLabel} - ${distributorName} / ${areaName}`,
            contents: {
              type: 'bubble',
              size: 'mega',
              header: {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: headerColor,
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'text',
                    text: `${categoryEmoji} ${categoryLabel}`,
                    color: '#FFFFFF',
                    weight: 'bold',
                    size: 'lg',
                    flex: 1,
                  },
                  {
                    type: 'text',
                    text: '完了',
                    color: '#FFFFFF',
                    size: 'sm',
                    align: 'end',
                    gravity: 'center',
                  },
                ],
              },
              ...(mapImageUrl ? {
                hero: {
                  type: 'image',
                  url: mapImageUrl,
                  size: 'full',
                  aspectRatio: '3:2',
                  aspectMode: 'cover',
                },
              } : {}),
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                paddingAll: 'lg',
                contents: [
                  // Distributor + StaffId
                  {
                    type: 'box', layout: 'horizontal', spacing: 'sm',
                    contents: [
                      { type: 'text', text: '配布員', size: 'sm', color: '#888888', flex: 2 },
                      { type: 'text', text: `${distributorName}${staffId ? ` (${staffId})` : ''}`, size: 'sm', color: '#333333', flex: 5, weight: 'bold' },
                    ],
                  },
                  // Area
                  {
                    type: 'box', layout: 'horizontal', spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'エリア', size: 'sm', color: '#888888', flex: 2 },
                      { type: 'text', text: areaName, size: 'sm', color: '#333333', flex: 5, wrap: true },
                    ],
                  },
                  // Inspector
                  {
                    type: 'box', layout: 'horizontal', spacing: 'sm',
                    contents: [
                      { type: 'text', text: '巡回員', size: 'sm', color: '#888888', flex: 2 },
                      { type: 'text', text: inspectorName, size: 'sm', color: '#333333', flex: 5 },
                    ],
                  },
                  // Separator
                  { type: 'separator', margin: 'lg' },
                  // Rates
                  {
                    type: 'box', layout: 'horizontal', margin: 'lg',
                    contents: [
                      {
                        type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                        contents: [
                          { type: 'text', text: confRateStr, size: 'xxl', weight: 'bold', color: confirmationRate != null && confirmationRate >= 0.8 ? '#22c55e' : confirmationRate != null && confirmationRate >= 0.5 ? '#f59e0b' : '#ef4444' },
                          { type: 'text', text: '確認率', size: 'xs', color: '#888888' },
                        ],
                      },
                      { type: 'separator' },
                      {
                        type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                        contents: [
                          { type: 'text', text: compRateStr, size: 'xxl', weight: 'bold', color: complianceRate != null && complianceRate >= 0.8 ? '#22c55e' : complianceRate != null && complianceRate >= 0.5 ? '#f59e0b' : '#ef4444' },
                          { type: 'text', text: '遵守率', size: 'xs', color: '#888888' },
                        ],
                      },
                    ],
                  },
                  // Separator
                  { type: 'separator', margin: 'lg' },
                  // Checkpoint counts
                  {
                    type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'md',
                    contents: [
                      {
                        type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                        contents: [
                          { type: 'text', text: `✓ ${confirmedCount}`, size: 'md', weight: 'bold', color: '#22c55e' },
                          { type: 'text', text: '確認', size: 'xxs', color: '#888888' },
                        ],
                      },
                      {
                        type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                        contents: [
                          { type: 'text', text: `✗ ${notFoundCount}`, size: 'md', weight: 'bold', color: '#e74c3c' },
                          { type: 'text', text: '未発見', size: 'xxs', color: '#888888' },
                        ],
                      },
                      {
                        type: 'box', layout: 'vertical', flex: 1, alignItems: 'center',
                        contents: [
                          { type: 'text', text: `? ${unableCount}`, size: 'md', weight: 'bold', color: '#95a5a6' },
                          { type: 'text', text: '確認不可', size: 'xxs', color: '#888888' },
                        ],
                      },
                    ],
                  },
                  // Note section (conditional)
                  ...noteSection,
                ],
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: 'md',
                contents: [
                  { type: 'text', text: jstNow, size: 'xs', color: '#AAAAAA', align: 'center' },
                ],
              },
            },
          };

          await pushMessage(groupSetting.value, [flexMessage]);
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
