import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

// GET /api/distributors/prefixes
// PMS管理対象の配布員スタッフIDプレフィックス一覧を返す
export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;

  const distributors = await prisma.flyerDistributor.findMany({
    where: { staffId: { not: '' } },
    select: { staffId: true },
  });

  // 除外プレフィックス（PMS対象外）
  const EXCLUDED_PREFIXES = ['NAI', 'Test', 'B01-'];

  const prefixes = new Set<string>();
  for (const d of distributors) {
    if (d.staffId) {
      const prefix = d.staffId.replace(/[0-9]+$/, '');
      if (prefix && !EXCLUDED_PREFIXES.includes(prefix)) prefixes.add(prefix);
    }
  }

  return NextResponse.json([...prefixes].sort());
}
