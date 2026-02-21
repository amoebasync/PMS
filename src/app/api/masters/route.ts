import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // ★ 追加: ロールマスタの初期データ自動投入
    const roleCount = await prisma.role.count();
    if (roleCount === 0) {
      await prisma.role.createMany({
        data: [
          { code: 'SUPER_ADMIN', name: 'スーパー管理者', permissionLevel: 'ALL' },
          { code: 'HR_ADMIN', name: '人事管理者', permissionLevel: 'HR_ALL' },
          { code: 'HR_VIEWER', name: '人事閲覧者', permissionLevel: 'HR_READ' },
        ]
      });
    }

    const [departments, roles, countries] = await Promise.all([
      prisma.department.findMany({ orderBy: { id: 'asc' } }),
      prisma.role.findMany({ orderBy: { id: 'asc' } }),
      prisma.country.findMany({ orderBy: { id: 'asc' } }) 
    ]);

    return NextResponse.json({ departments, roles, countries });
  } catch (error) {
    console.error('Master Data Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch masters' }, { status: 500 });
  }
}