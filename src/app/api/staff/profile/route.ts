import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getDistributorFromCookie } from '@/lib/distributorAuth';


export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { passwordHash, ...safeData } = distributor;

    // LIFFログインの場合はパスワード変更を強制しない
    const cookieStore = await cookies();
    if (cookieStore.get('pms_liff_session')?.value) {
      safeData.isPasswordTemp = false;
    }

    return NextResponse.json(safeData);
  } catch (error) {
    console.error('Distributor Profile GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();

    const updated = await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: {
        phone: body.phone ?? distributor.phone,
        email: body.email ?? distributor.email,
        postalCode: body.postalCode ?? distributor.postalCode,
        address: body.address ?? distributor.address,
        buildingName: body.buildingName ?? distributor.buildingName,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : distributor.avatarUrl,
      },
    });

    const { passwordHash, ...safeData } = updated;
    return NextResponse.json(safeData);
  } catch (error) {
    console.error('Distributor Profile PUT Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
