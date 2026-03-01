import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET /api/branches/[id]/next-staff-id
// 管理者: 支店の staffIdSeq を元に次のスタッフIDを返す（DB更新はしない）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const branchId = parseInt(id);

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { prefix: true, staffIdSeq: true },
    });

    if (!branch) {
      return NextResponse.json({ error: '支店が見つかりません' }, { status: 404 });
    }

    const prefix = branch.prefix || '';

    if (!prefix) {
      return NextResponse.json({ nextStaffId: null, prefix: null, nextSeq: null });
    }

    const nextSeq = (branch.staffIdSeq ?? 0) + 1;
    const nextStaffId = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    return NextResponse.json({ nextStaffId, prefix, nextSeq });
  } catch (error) {
    console.error('Next Staff ID Error:', error);
    return NextResponse.json({ error: 'スタッフIDの生成に失敗しました' }, { status: 500 });
  }
}
