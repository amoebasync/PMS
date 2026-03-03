import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

export async function PUT() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: { hasSeenOnboarding: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding API Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
