import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

// GET /api/distributors/prefixes
// PMS管理対象の支店プレフィックス一覧を返す（Branch.prefixから取得）
export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;

  const branches = await prisma.branch.findMany({
    where: { prefix: { not: null } },
    select: { prefix: true },
  });

  const prefixes = branches
    .map(b => b.prefix!)
    .filter(p => p.trim() !== '')
    .sort();

  return NextResponse.json(prefixes);
}
