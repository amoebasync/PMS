import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- 納品履歴の取得 ---
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const flyerId = parseInt(id, 10);

    const deliveries = await prisma.flyerDelivery.findMany({
      where: { flyerId: flyerId },
      orderBy: { expectedAt: 'desc' } // 新しい順に並べる
    });

    return NextResponse.json(deliveries);
  } catch (error) {
    console.error('Fetch Deliveries Error:', error);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}

// --- 新規納品の登録 ＆ 在庫の自動加算 ---
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const flyerId = parseInt(id, 10);
    const body = await request.json();

    const count = parseInt(body.count, 10);
    if (isNaN(count) || count <= 0) {
      return NextResponse.json({ error: '枚数は1以上を入力してください' }, { status: 400 });
    }

    // ★ トランザクション：履歴の作成と、親(Flyer)の在庫更新を同時に行う（途中でエラーが出たら両方キャンセルされる安全な仕組み）
    const result = await prisma.$transaction(async (tx) => {
      // 1. 納品履歴を作成
      const delivery = await tx.flyerDelivery.create({
        data: {
          flyerId: flyerId,
          expectedAt: new Date(body.expectedAt),
          actualAt: body.status === 'COMPLETED' ? new Date() : null, // 完了なら実績日時に「今」を入れる
          count: count,
          status: body.status,
          note: body.note || null,
        }
      });

      // 2. ステータスが「完了（納品済み）」の場合のみ、親チラシの在庫と累計数を増やす
      if (delivery.status === 'COMPLETED') {
        await tx.flyer.update({
          where: { id: flyerId },
          data: {
            stockCount: { increment: count },    // 現在庫を増やす
            totalReceived: { increment: count }  // 累計納品数を増やす
          }
        });
      }

      return delivery;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Create Delivery Error:', error);
    return NextResponse.json({ error: 'Failed to create delivery' }, { status: 500 });
  }
}