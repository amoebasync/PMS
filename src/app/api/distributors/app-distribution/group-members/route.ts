import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listGoogleGroupMembers, isGooglePlayTesterConfigured } from '@/lib/google-play-tester';

// GET /api/distributors/app-distribution/group-members
// Googleグループの現在のメンバー一覧を取得（管理者デバッグ用）
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  if (!isGooglePlayTesterConfigured()) {
    return NextResponse.json({ error: 'Google Play テスター管理APIが設定されていません' }, { status: 400 });
  }

  const result = await listGoogleGroupMembers();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    groupEmail: process.env.GOOGLE_PLAY_TESTER_GROUP_EMAIL,
    memberCount: result.members?.length || 0,
    members: result.members,
  });
}
