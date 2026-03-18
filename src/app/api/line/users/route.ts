import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/line/users — LINE ユーザー一覧（紐付け状況含む）
 * ?filter=all|linked|unlinked  &search=xxx
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';
  const search = url.searchParams.get('search') || '';

  const where: any = {};

  if (filter === 'linked') {
    where.distributorId = { not: null };
  } else if (filter === 'unlinked') {
    where.distributorId = null;
  }

  if (search) {
    where.displayName = { contains: search };
  }

  const users = await prisma.lineUser.findMany({
    where,
    include: {
      distributor: {
        select: {
          id: true,
          name: true,
          staffId: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { distributorId: 'asc' }, // 未紐付き（null）が先
      { displayName: 'asc' },
    ],
  });

  return NextResponse.json(users);
}
