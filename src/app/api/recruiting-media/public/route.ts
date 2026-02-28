import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/recruiting-media/public?code=xxx
// 公開API: codeで求人媒体を検索して返す
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(null);
    }

    const media = await prisma.recruitingMedia.findUnique({
      where: { code: code.toLowerCase().trim() },
      select: {
        id: true,
        nameJa: true,
        nameEn: true,
        code: true,
      },
    });

    return NextResponse.json(media);
  } catch (error) {
    console.error('Recruiting Media Public Fetch Error:', error);
    return NextResponse.json(null);
  }
}
