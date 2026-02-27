import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET /api/search-assignees?q=keyword
// 担当者（社員・部署・支店）を横断検索
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q || q.length < 1) {
      return NextResponse.json([]);
    }

    // 社員検索
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        OR: [
          { lastNameJa: { contains: q } },
          { firstNameJa: { contains: q } },
          { lastNameKana: { contains: q } },
          { firstNameKana: { contains: q } },
          { employeeCode: { contains: q } },
        ],
      },
      select: {
        id: true,
        lastNameJa: true,
        firstNameJa: true,
        department: { select: { name: true } },
      },
      take: 10,
    });

    // 部署検索
    const departments = await prisma.department.findMany({
      where: {
        name: { contains: q },
      },
      select: {
        id: true,
        name: true,
        _count: { select: { employees: true } },
      },
      take: 5,
    });

    // 支店検索
    const branches = await prisma.branch.findMany({
      where: {
        OR: [
          { nameJa: { contains: q } },
          { nameEn: { contains: q } },
        ],
      },
      select: {
        id: true,
        nameJa: true,
        _count: { select: { employees: true } },
      },
      take: 5,
    });

    // 統合結果を返す
    const results = [
      ...employees.map((e) => ({
        type: 'employee' as const,
        id: e.id,
        label: `${e.lastNameJa} ${e.firstNameJa}`,
        sub: e.department?.name || '',
      })),
      ...departments.map((d) => ({
        type: 'department' as const,
        id: d.id,
        label: d.name,
        sub: `社員${d._count.employees}名`,
      })),
      ...branches.map((b) => ({
        type: 'branch' as const,
        id: b.id,
        label: b.nameJa,
        sub: `支店（社員${b._count.employees}名）`,
      })),
    ];

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search Assignees Error:', error);
    return NextResponse.json({ error: '検索に失敗しました' }, { status: 500 });
  }
}
