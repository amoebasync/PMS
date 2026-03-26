/**
 * テスト: 指導レポートLINE通知を再送信（NO_MISTAKES色修正確認用）
 * Usage: npx tsx scripts/test-line-inspection.ts
 */
import { PrismaClient } from '@prisma/client';
import { pushMessage, isLineConfigured } from '../src/lib/line';

const prisma = new PrismaClient();

async function main() {
  if (!isLineConfigured()) {
    console.error('LINE not configured');
    return;
  }

  const inspectionId = 14;

  const result = await prisma.fieldInspection.findUnique({
    where: { id: inspectionId },
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

  if (!result) { console.error('Not found'); return; }

  const checkpoints = await prisma.inspectionCheckpoint.findMany({
    where: { inspectionId },
  });

  const groupSetting = await prisma.systemSetting.findUnique({
    where: { key: 'lineInspectionNotificationGroupId' },
  });
  if (!groupSetting?.value) { console.error('No group'); return; }

  const distributorName = result.distributor?.name || '-';
  const staffId = result.distributor?.staffId || '';
  const inspectorName = result.inspector
    ? `${result.inspector.lastNameJa}${result.inspector.firstNameJa}`
    : '-';
  const area = (result as any).schedule?.area;
  const areaName = area
    ? `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`
    : '-';
  const now = new Date();
  const jstNow = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  // Map image
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  let mapImageUrl = '';
  if (mapboxToken && area?.boundary_geojson) {
    try {
      const geojson = typeof area.boundary_geojson === 'string' ? JSON.parse(area.boundary_geojson) : area.boundary_geojson;
      const coords: number[][] = geojson.type === 'Polygon' ? geojson.coordinates[0] : geojson.coordinates?.flat(2) || [];
      if (coords.length > 0) {
        const centerLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
        const centerLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
        const pins = checkpoints
          .filter(cp => cp.targetLat != null && cp.targetLng != null)
          .map(cp => cp.result === 'CONFIRMED' ? `pin-l+22c55e(${cp.targetLng},${cp.targetLat})` : `pin-l-x+e74c3c(${cp.targetLng},${cp.targetLat})`);
        const overlay = pins.length > 0 ? pins.join(',') : `pin-s+999999(${centerLng},${centerLat})`;
        mapImageUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/${centerLng},${centerLat},14.5,0/600x400@2x?access_token=${mapboxToken}`;
      }
    } catch {}
  }

  // Evaluation
  const SPEED_LABELS: Record<string, string> = { VERY_SLOW: 'とても遅い', SLOW: '遅い', NORMAL: '普通', FAST: '速い', VERY_FAST: 'とても速い' };
  const LEVEL_LABELS: Record<string, string> = { BAD: '悪い', NORMAL: '普通', GOOD: '良い', NO_MISTAKES: 'ミスなし' };
  const SPEED_MAP: Record<string, number> = { VERY_SLOW: 1, SLOW: 2, NORMAL: 3, FAST: 4, VERY_FAST: 5 };
  const LEVEL_MAP: Record<string, number> = { BAD: 1, NORMAL: 2, GOOD: 3, NO_MISTAKES: 3 };
  const levelColor = (v: string | null) => v === 'GOOD' || v === 'FAST' || v === 'VERY_FAST' || v === 'NO_MISTAKES' ? '#22c55e' : v === 'NORMAL' ? '#f59e0b' : '#ef4444';

  const rateBar = (filled: number, total: number, color: string) => {
    const contents: any[] = [];
    for (let i = 0; i < total; i++) {
      contents.push({ type: 'box', layout: 'vertical', flex: 1, height: '6px', backgroundColor: i < filled ? color : '#E5E7EB', cornerRadius: '3px', contents: [{ type: 'filler' }] });
    }
    return { type: 'box', layout: 'horizontal', spacing: 'xs', contents };
  };

  const guidanceItems = [
    { label: '配布スピード', value: result.distributionSpeed, labels: SPEED_LABELS, map: SPEED_MAP, total: 5 },
    { label: 'ステッカー遵守', value: result.stickerCompliance, labels: LEVEL_LABELS, map: LEVEL_MAP, total: 3 },
    { label: '禁止物件遵守', value: result.prohibitedCompliance, labels: LEVEL_LABELS, map: LEVEL_MAP, total: 3 },
    { label: '地図理解度', value: result.mapComprehension, labels: LEVEL_LABELS, map: LEVEL_MAP, total: 3 },
    { label: '勤務態度', value: result.workAttitude, labels: LEVEL_LABELS, map: LEVEL_MAP, total: 3 },
  ].filter(item => item.value);

  const evaluationSection: any[] = [{ type: 'separator', margin: 'lg' }];
  for (const item of guidanceItems) {
    const filled = item.map[item.value!] || 0;
    const color = levelColor(item.value);
    evaluationSection.push({
      type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: item.label, size: 'xs', color: '#666666', flex: 3 },
          { type: 'text', text: item.labels[item.value!] || item.value, size: 'xs', color, weight: 'bold', flex: 2, align: 'end' },
        ]},
        rateBar(filled, item.total, color),
      ],
    });
  }

  let noteSection: any[] = [];
  if (result.note) {
    const asciiLetters = (result.note.match(/[a-zA-Z]/g) || []).length;
    const totalChars = result.note.replace(/\s/g, '').length;
    const isEnglish = totalChars > 0 && asciiLetters / totalChars > 0.5;

    let translatedNote = '';
    if (isEnglish && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log('Translating note...');
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
          console.log('Translation:', translatedNote);
        }
      } catch (e) { console.error('Translation error:', e); }
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
          }] : []),
        ],
      },
    ];
  }

  const flexMessage = {
    type: 'flex',
    altText: `📋 指導レポート（テスト送信） - ${distributorName} / ${areaName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'horizontal', backgroundColor: '#3b82f6', paddingAll: 'lg',
        contents: [
          { type: 'text', text: '📋 指導レポート', color: '#FFFFFF', weight: 'bold', size: 'lg', flex: 1 },
          { type: 'text', text: '完了', color: '#FFFFFF', size: 'sm', align: 'end', gravity: 'center' },
        ],
      },
      ...(mapImageUrl ? { hero: { type: 'image', url: mapImageUrl, size: 'full', aspectRatio: '3:2', aspectMode: 'cover' } } : {}),
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'lg',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: '配布員', size: 'sm', color: '#888888', flex: 2 },
              { type: 'box', layout: 'vertical', flex: 5, contents: [
                { type: 'text', text: distributorName, size: 'sm', color: '#333333', weight: 'bold' },
                ...(staffId ? [{ type: 'text' as const, text: staffId, size: 'xxs' as const, color: '#999999' }] : []),
              ]},
            ],
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: 'エリア', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: areaName, size: 'sm', color: '#333333', flex: 5, wrap: true },
            ],
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: '巡回員', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: inspectorName, size: 'sm', color: '#333333', flex: 5 },
            ],
          },
          ...evaluationSection,
          ...noteSection,
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md',
        contents: [{ type: 'text', text: `${jstNow}（テスト送信）`, size: 'xs', color: '#AAAAAA', align: 'center' }],
      },
    },
  };

  console.log('Sending to group:', groupSetting.value);
  await pushMessage(groupSetting.value, [flexMessage]);
  console.log('Sent!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
