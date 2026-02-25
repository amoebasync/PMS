import { NextResponse } from 'next/server';
import { getPresignedUrl } from '@/lib/s3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  try {
    const presignedUrl = await getPresignedUrl(key, 3600);
    return NextResponse.redirect(presignedUrl, 302);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
