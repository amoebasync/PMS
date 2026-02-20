import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { sendScanNotification } from '@/lib/mailer'; // ★追加

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ alias: string }> }) {
  try {
    const { alias } = await params;
    
    // ★ 修正: flyerの情報も一緒に取得する
    const qrCode = await prisma.qrCode.findUnique({
      where: { alias },
      include: { flyer: true }
    });

    if (!qrCode) return NextResponse.redirect(new URL('/', request.url));

    let rawTargetUrl = qrCode.isActive ? qrCode.redirectUrl : new URL('/', request.url).toString();
    if (!/^https?:\/\//i.test(rawTargetUrl)) rawTargetUrl = 'https://' + rawTargetUrl;
    
    let targetUrl: URL;
    try { targetUrl = new URL(rawTargetUrl); } 
    catch { targetUrl = new URL('/', request.url); }

    const userAgent = request.headers.get('user-agent') || '';
    let ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    if (ipAddress) ipAddress = ipAddress.split(',')[0].trim().substring(0, 50);
    const city = request.headers.get('x-vercel-ip-city') || '';
    const country = request.headers.get('x-vercel-ip-country') || '';
    const location = city || country ? `${city}, ${country}`.substring(0, 100) : null;

    let deviceType = 'Desktop';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) deviceType = 'Mobile';
    else if (/iPad|tablet/i.test(userAgent)) deviceType = 'Tablet';

    let os = 'Unknown', browser = 'Unknown';
    if (/android/i.test(userAgent)) os = 'Android';
    else if (/iPad|iPhone|iPod/.test(userAgent)) os = 'iOS';
    else if (/Mac OS X/.test(userAgent)) os = 'Mac OS X';
    else if (/Windows/.test(userAgent)) os = 'Windows';

    if (/Line/i.test(userAgent)) browser = 'LINE'; 
    else if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent) && !/OPR/.test(userAgent)) browser = 'Chrome';
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) browser = 'Safari';
    else if (/Firefox|FxiOS/.test(userAgent)) browser = 'Firefox';
    else if (/Edg/.test(userAgent)) browser = 'Edge';

    const cookieHeader = request.headers.get('cookie') || '';
    let visitorId = null;
    const match = cookieHeader.match(/qr_visitor_id=([^;]+)/);
    if (match) visitorId = match[1];
    else visitorId = crypto.randomUUID();

    try {
      await prisma.qrScanLog.create({
        data: {
          qrCodeId: qrCode.id, ipAddress, userAgent: userAgent.substring(0, 500),
          deviceType, os, browser, location, visitorId,
        }
      });

      // ★ 追加: メール通知設定がONの場合、非同期でメールを送信
      if (qrCode.notifyOnScan && qrCode.notificationEmails) {
        const emails = qrCode.notificationEmails.split(',').map(e => e.trim()).filter(Boolean);
        if (emails.length > 0) {
          // リダイレクトを遅延させないため、awaitせずに投げ放しにする
          sendScanNotification(emails, qrCode, qrCode.flyer.name, location, deviceType).catch(console.error);
        }
      }

    } catch (dbError) { console.error('QR Log Save Error:', dbError); }

    const response = NextResponse.redirect(targetUrl);
    response.cookies.set('qr_visitor_id', visitorId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}