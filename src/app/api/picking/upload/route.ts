import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActorInfo } from '@/lib/audit';
import { uploadToS3 } from '@/lib/s3';

// Claude Messages API をfetchで呼び出すヘルパー
async function callClaudeVision(
  systemPrompt: string,
  userPrompt: string,
  base64Image: string,
  mediaType: string
): Promise<{ result: 'MATCH' | 'MISMATCH' | 'UNCERTAIN'; reason: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const textContent = data.content?.find((c: { type: string }) => c.type === 'text');
  if (textContent?.text) {
    const jsonMatch = textContent.text.match(/\{[\s\S]*"result"[\s\S]*"reason"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (['MATCH', 'MISMATCH', 'UNCERTAIN'].includes(parsed.result)) {
        return { result: parsed.result, reason: parsed.reason || '' };
      }
    }
  }

  return { result: 'UNCERTAIN', reason: 'AIレスポンスの解析に失敗しました' };
}

// POST /api/picking/upload
// 写真アップロード + Claude Vision AIで照合
export async function POST(request: NextRequest) {
  try {
    const { actorId } = await getAdminActorInfo();
    if (!actorId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const formData = await request.formData();
    const scheduleId = parseInt(formData.get('scheduleId') as string, 10);
    const photoFile = formData.get('photo') as File;
    // 類似チラシ警告情報（オプション）
    const similarWarningsJson = formData.get('similarWarnings') as string | null;

    if (!scheduleId || isNaN(scheduleId) || !photoFile) {
      return NextResponse.json(
        { error: 'scheduleId と photo が必要です' },
        { status: 400 }
      );
    }

    // スケジュールとアイテム情報を取得
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        distributor: { select: { name: true, staffId: true } },
        items: {
          include: {
            customer: { select: { id: true, name: true } },
            flyer: { select: { name: true, flyerCode: true, remarks: true } },
          },
          orderBy: { slotIndex: 'asc' },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    // 写真をS3にアップロード
    const buffer = Buffer.from(await photoFile.arrayBuffer());
    const ext = photoFile.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const s3Key = `uploads/picking/${scheduleId}/${timestamp}.${ext}`;
    const photoUrl = await uploadToS3(buffer, s3Key, photoFile.type);

    // 当日の同一顧客の他チラシ情報を取得（類似チラシ注意喚起用）
    const customerIds = schedule.items
      .map(item => item.customerId)
      .filter((id): id is number => id !== null);

    let similarFlyerInfo = '';
    if (customerIds.length > 0) {
      const sameDayItems = await prisma.distributionItem.findMany({
        where: {
          schedule: { date: schedule.date },
          customerId: { in: customerIds },
          scheduleId: { not: scheduleId },
        },
        include: {
          customer: { select: { name: true } },
          flyer: { select: { name: true, flyerCode: true } },
        },
      });

      if (sameDayItems.length > 0) {
        const grouped = new Map<number, { customerName: string; flyers: string[] }>();
        for (const item of sameDayItems) {
          if (!item.customerId) continue;
          if (!grouped.has(item.customerId)) {
            grouped.set(item.customerId, {
              customerName: item.customer?.name || '不明',
              flyers: [],
            });
          }
          const flyerDesc = `${item.flyer?.name || item.flyerName || '不明'}(${item.flyer?.flyerCode || item.flyerCode || '?'})`;
          const g = grouped.get(item.customerId)!;
          if (!g.flyers.includes(flyerDesc)) {
            g.flyers.push(flyerDesc);
          }
        }
        if (grouped.size > 0) {
          similarFlyerInfo = '\n\n【重要：同一顧客の他チラシ（当日別スケジュール）】\n混同しないよう注意してください:\n' +
            Array.from(grouped.values())
              .map(g => `- ${g.customerName}: ${g.flyers.join(', ')}`)
              .join('\n');
        }
      }
    }

    // チラシ情報をClaude Visionに渡すプロンプトを構築
    const flyerInfo = schedule.items.map((item, idx) => {
      const flyerName = item.flyer?.name || item.flyerName || '不明';
      const flyerCode = item.flyer?.flyerCode || item.flyerCode || '不明';
      const customerName = item.customer?.name || '不明';
      const plannedCount = item.plannedCount || 0;
      const remarks = item.flyer?.remarks || item.remarks || '';
      return `${idx + 1}. チラシ名: ${flyerName}, コード: ${flyerCode}, 顧客: ${customerName}, 枚数: ${plannedCount}枚${remarks ? `, 備考: ${remarks}` : ''}`;
    }).join('\n');

    // フロントエンドから渡された類似チラシ警告も追加
    let similarWarningText = '';
    if (similarWarningsJson) {
      try {
        const warnings = JSON.parse(similarWarningsJson);
        if (warnings.length > 0) {
          similarWarningText = '\n\n【類似チラシ警告（フロントエンド検出）】\n以下の顧客は当日に複数の異なるチラシがあります。混同注意:\n' +
            warnings.map((w: { customerName: string; flyerCodes: string[] }) =>
              `- ${w.customerName}: ${w.flyerCodes.join(', ')}`
            ).join('\n');
        }
      } catch {
        // パース失敗時は無視
      }
    }

    const systemPrompt = `あなたはポスティング業務のピッキング照合を行うAIアシスタントです。
写真に写っているチラシが、指定されたチラシリストと一致しているかを判定してください。

判定結果は以下の3種類から1つを選んでください：
- MATCH: 全てのチラシが正しく揃っている
- MISMATCH: 明らかに異なるチラシが含まれている、または必要なチラシが足りない
- UNCERTAIN: 写真が不鮮明、または判断が難しい場合

回答は必ず以下のJSON形式で返してください：
{
  "result": "MATCH" | "MISMATCH" | "UNCERTAIN",
  "reason": "判定理由を日本語で簡潔に説明"
}`;

    const userPrompt = `以下のチラシがこのスケジュールで必要です：

${flyerInfo}${similarFlyerInfo}${similarWarningText}

写真に写っているチラシがこのリストと一致しているか確認してください。
チラシの種類、枚数が正しいか判定してください。`;

    // 画像をBase64に変換してClaude Vision APIを呼び出し
    const base64Image = buffer.toString('base64');
    const mediaType = photoFile.type || 'image/jpeg';

    let aiResult: 'MATCH' | 'MISMATCH' | 'UNCERTAIN' = 'UNCERTAIN';
    let aiReason = '';

    try {
      const visionResult = await callClaudeVision(systemPrompt, userPrompt, base64Image, mediaType);
      aiResult = visionResult.result;
      aiReason = visionResult.reason;
    } catch (aiError) {
      console.error('Claude Vision API error:', aiError);
      aiReason = 'AI照合中にエラーが発生しました。人的チェックで確認してください。';
    }

    // PickingVerificationを作成または更新（撮り直し対応: 既存レコードがあれば更新）
    const now = new Date();
    const verification = await prisma.pickingVerification.upsert({
      where: { scheduleId },
      create: {
        scheduleId,
        photoUrl,
        pickerId: actorId,
        pickedAt: now,
        aiResult,
        aiReason,
        aiCheckedAt: now,
        status: 'AI_CHECKED',
      },
      update: {
        photoUrl,
        pickerId: actorId,
        pickedAt: now,
        aiResult,
        aiReason,
        aiCheckedAt: now,
        status: 'AI_CHECKED',
        // 撮り直し時は人的チェック結果をリセット
        checkerId: null,
        checkerResult: null,
        checkerNote: null,
        checkedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      verification: {
        id: verification.id,
        photoUrl: verification.photoUrl,
        aiResult: verification.aiResult,
        aiReason: verification.aiReason,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error('POST /api/picking/upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
