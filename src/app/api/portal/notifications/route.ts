// src/app/api/portal/notifications/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    // ログイン中のセッションからユーザー情報を取得
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ notifications: [] });
    }

    // 担当者IDから紐づく会社(Customer)のIDを取得
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json({ notifications: [] });
    }
    
    const customerId = contact.customerId;

    // 1. 通常の通知を取得 (最新20件)
    const normalNotifications = await prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 2. 要対応アクションをOrderテーブルから動的に生成
    const actionRequiredOrders = await prisma.order.findMany({
      where: {
        customerId,
        status: { in: ['PENDING_SUBMISSION', 'PENDING_PAYMENT', 'ADJUSTING'] }
      },
      select: { id: true, orderNo: true, title: true, status: true }
    });

    const actionNotifications = actionRequiredOrders.map(order => {
      let title = '';
      let message = '';
      if (order.status === 'PENDING_SUBMISSION') {
        title = '入稿データが必要です';
        message = `案件「${order.title || order.orderNo}」の入稿をお済ませください。`;
      } else if (order.status === 'PENDING_PAYMENT') {
        title = 'お支払いをお済ませください';
        message = `案件「${order.title || order.orderNo}」の入金待ちです。`;
      } else if (order.status === 'ADJUSTING') {
        title = '内容の調整中です';
        message = `案件「${order.title || order.orderNo}」について、内容のご確認をお願いします。`;
      }

      return {
        id: `action-${order.id}`, // 仮想ID
        orderId: order.id,
        orderNo: order.orderNo,
        title,
        message,
        type: 'ACTION_REQUIRED',
        isRead: false, // 要対応タスクは常に未読扱い
        createdAt: new Date().toISOString(),
      };
    });

    // まとめてフロントへ返す
    const allNotifications = [...actionNotifications, ...normalNotifications];

    return NextResponse.json({ notifications: allNotifications });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}