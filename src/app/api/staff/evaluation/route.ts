import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// System setting defaults
const SETTING_DEFAULTS: Record<string, string> = {
  evalBaseScore: '100',
  evalRankS: '120',
  evalRankA: '100',
  evalRankB: '80',
  evalRankC: '60',
};

// GET /api/staff/evaluation
// スタッフ: 自分の評価履歴・ランク・次ランクまでのスコアを取得
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    // Load system settings for rank thresholds
    const settingRows = await prisma.systemSetting.findMany({
      where: {
        key: { in: Object.keys(SETTING_DEFAULTS) },
      },
    });

    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) {
      settings[row.key] = row.value;
    }

    const evalRankS = parseInt(settings.evalRankS);
    const evalRankA = parseInt(settings.evalRankA);
    const evalRankB = parseInt(settings.evalRankB);
    const evalRankC = parseInt(settings.evalRankC);

    // Get last 12 evaluations
    const evaluations = await prisma.distributorEvaluation.findMany({
      where: { distributorId: distributor.id },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });

    // Calculate score needed for next rank
    const currentScore = distributor.currentScore;
    const currentRank = distributor.rank || 'C';
    let scoreForNextRank: number | null = null;
    let nextRank: string | null = null;

    if (currentRank === 'D') {
      scoreForNextRank = evalRankC - currentScore;
      nextRank = 'C';
    } else if (currentRank === 'C') {
      scoreForNextRank = evalRankB - currentScore;
      nextRank = 'B';
    } else if (currentRank === 'B') {
      scoreForNextRank = evalRankA - currentScore;
      nextRank = 'A';
    } else if (currentRank === 'A') {
      scoreForNextRank = evalRankS - currentScore;
      nextRank = 'S';
    }
    // S rank: already at top

    return NextResponse.json({
      currentRank,
      currentScore,
      evaluations,
      nextRank,
      scoreForNextRank: scoreForNextRank !== null ? Math.max(0, scoreForNextRank) : null,
      thresholds: {
        S: evalRankS,
        A: evalRankA,
        B: evalRankB,
        C: evalRankC,
      },
    });
  } catch (error) {
    console.error('Staff Evaluation Error:', error);
    return NextResponse.json({ error: '評価情報の取得に失敗しました' }, { status: 500 });
  }
}
