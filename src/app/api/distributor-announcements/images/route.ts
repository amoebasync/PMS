import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { uploadToS3, getMimeType } from '@/lib/s3';
import { randomUUID } from 'crypto';

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// POST: Upload image for distributor announcement
export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: '対応していないファイル形式です' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uuid = randomUUID();
    const s3Key = `uploads/distributor-announcements/${uuid}.${ext}`;
    const url = await uploadToS3(buffer, s3Key, getMimeType(ext));

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Announcement image upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
