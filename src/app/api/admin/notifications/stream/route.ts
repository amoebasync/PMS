import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { notificationEmitter } from '@/lib/notification-emitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getEmployeeFromSession(): Promise<{ id: number } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  const employee = await prisma.employee.findUnique({
    where: { id: parseInt(sessionId) },
    select: { id: true },
  });
  return employee;
}

export async function GET(request: NextRequest) {
  const employee = await getEmployeeFromSession();
  if (!employee) {
    return new Response('Unauthorized', { status: 401 });
  }

  const employeeId = employee.id;
  const encoder = new TextEncoder();
  let closed = false;
  let lastCheckedId = 0;

  // Get the latest notification ID at connection time
  const latest = await prisma.adminNotification.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  lastCheckedId = latest?.id ?? 0;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ employeeId })}\n\n`));

      const safeSend = (msg: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(msg)); } catch { closed = true; }
      };

      // Listen for in-memory events (same-process instant push)
      const unsubscribe = notificationEmitter.subscribe(async (data) => {
        if (closed) return;
        if (data.recipientId !== undefined && data.recipientId !== null && data.recipientId !== employeeId) return;
        try {
          const notifications = await prisma.adminNotification.findMany({
            where: { id: { gt: lastCheckedId }, OR: [{ recipientId: null }, { recipientId: employeeId }] },
            orderBy: { id: 'desc' }, take: 10,
            include: { distributor: { select: { name: true, staffId: true } } },
          });
          if (notifications.length > 0) {
            lastCheckedId = Math.max(...notifications.map(n => n.id));
            safeSend(`event: notification\ndata: ${JSON.stringify({ notifications })}\n\n`);
          }
        } catch (e) { if (!closed) console.error('[SSE] Error:', e); }
      });

      // DB polling fallback (for notifications from the other EC2 instance)
      const pollInterval = setInterval(async () => {
        if (closed) return;
        try {
          const notifications = await prisma.adminNotification.findMany({
            where: { id: { gt: lastCheckedId }, OR: [{ recipientId: null }, { recipientId: employeeId }] },
            orderBy: { id: 'desc' }, take: 10,
            include: { distributor: { select: { name: true, staffId: true } } },
          });
          if (notifications.length > 0) {
            lastCheckedId = Math.max(...notifications.map(n => n.id));
            safeSend(`event: notification\ndata: ${JSON.stringify({ notifications })}\n\n`);
          }
        } catch (e) { if (!closed) console.error('[SSE] Poll error:', e); }
      }, 15000);

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        safeSend(`event: heartbeat\ndata: {}\n\n`);
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        closed = true;
        unsubscribe();
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // For Nginx/ALB
    },
  });
}
