import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { writeAuditLog, getIpAddress } from '@/lib/audit';

/**
 * POST /api/staff/auth/line-login
 * LIFF経由のLINE自動ログイン
 * body: { lineUserId: string }
 */
export async function POST(request: NextRequest) {
  const ip = getIpAddress(request);
  const ua = request.headers.get('user-agent');

  try {
    const { lineUserId } = await request.json();
    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });
    }

    // LINE User → Distributor
    const lineUser = await prisma.lineUser.findUnique({
      where: { lineUserId },
      select: { distributorId: true, distributor: true },
    });

    if (!lineUser?.distributorId || !lineUser.distributor) {
      return NextResponse.json({ error: 'LINE未連携' }, { status: 404 });
    }

    const distributor = lineUser.distributor;

    // セッションCookie発行
    const cookieStore = await cookies();
    cookieStore.set('pms_distributor_session', distributor.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    await writeAuditLog({
      actorType: 'STAFF',
      actorId: distributor.id,
      actorName: distributor.name,
      action: 'LOGIN_SUCCESS',
      targetModel: 'FlyerDistributor',
      targetId: distributor.id,
      description: `LINE自動ログイン: ${distributor.name}`,
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({
      success: true,
      language: distributor.language || 'ja',
      user: { name: distributor.name, staffId: distributor.staffId },
    });
  } catch (error) {
    console.error('LINE Login Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
