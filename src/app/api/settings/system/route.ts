import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


// デフォルト設定値
const DEFAULTS: Record<string, string> = {
  weekStartDay: '1', // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
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
