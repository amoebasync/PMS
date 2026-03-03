import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const VALID_KEYS = ['privacyPolicy', 'termsOfService', 'appPrivacyPolicy'];

// GET /api/legal-content?key=privacyPolicy
// 公開API: 法務コンテンツ取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key || !VALID_KEYS.includes(key)) {
      return NextResponse.json({ error: '無効なキーです' }, { status: 400 });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    return NextResponse.json({ content: setting?.value || null });
  } catch (error) {
    console.error('Legal Content GET Error:', error);
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/legal-content
// 管理者: 法務コンテンツ更新
export async function PUT(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, content } = body;

    if (!key || !VALID_KEYS.includes(key)) {
      return NextResponse.json({ error: '無効なキーです' }, { status: 400 });
    }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'コンテンツは文字列で指定してください' }, { status: 400 });
    }

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: content },
      create: { key, value: content },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Legal Content PUT Error:', error);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}
