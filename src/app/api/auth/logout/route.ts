import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    // Cookie削除前に actorInfo を取得する
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const cookieStore = await cookies();
    // ログイン時に発行したセッションCookieを削除
    cookieStore.delete('pms_session');

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'LOGOUT',
      targetModel: 'Employee',
      targetId: actorId,
      description: '管理者ログアウト',
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout Error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}