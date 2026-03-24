import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


// デフォルト設定値
const DEFAULTS: Record<string, string> = {
  weekStartDay: '1', // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  evalBaseScore: '100',       // 基本スコア
  evalAttendanceBonus: '5',   // 出勤1日あたりの加点
  evalSheetsBonus: '1',       // 配布N枚あたりの加点
  evalSheetsBonusUnit: '1000',// 枚数加点の単位
  evalRankS: '120',           // Sランク閾値（以上）
  evalRankA: '100',           // Aランク閾値（以上）
  evalRankB: '80',            // Bランク閾値（以上）
  evalRankC: '60',            // Cランク閾値（以上）、これ未満はDランク
  evalCycleDay: '0',          // 評価サイクル開始曜日（0=日,1=月...）
  rankRates: JSON.stringify({ S: [0,0,0,0,0,0], A: [0,0,0,0,0,0], B: [0,0,0,0,0,0], C: [0,0,0,0,0,0], D: [0,0,0,0,0,0] }),
  ratePlans: JSON.stringify([
    { name: 'Regular', rates: [2, 3, 3.5, 4.75, 6, 7.25] },
    { name: 'Advanced', rates: [2, 3.25, 3.75, 5, 6.25, 7.5] },
    { name: 'Pro', rates: [2.25, 3.5, 4, 5.25, 6.5, 7.75] },
  ]),
  headerLinks: JSON.stringify([]),  // ヘッダーリンク集
};

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session');
  return !!session?.value;
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.systemSetting.findMany();
  const settings: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { key, value } = body as { key: string; value: string };

  if (!key || value === undefined || value === null) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
  }

  const updated = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });

  return NextResponse.json(updated);
}
