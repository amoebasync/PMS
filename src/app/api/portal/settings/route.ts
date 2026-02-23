import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 認証不要 — ポータル向けの公開設定のみ返す
const PUBLIC_KEYS = ['supportPhone', 'supportEmail', 'companyName'];

export async function GET() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Portal Settings GET Error:', error);
    return NextResponse.json({}, { status: 500 });
  }
}
