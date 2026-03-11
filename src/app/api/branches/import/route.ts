import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const branches = await request.json();
    let importedCount = 0;
    let updatedCount = 0;

    const employees = await prisma.employee.findMany({
      select: { id: true, lastNameJa: true, firstNameJa: true },
    });
    const employeeFullNames = employees.map(e => ({
      id: e.id,
      fullName: `${e.lastNameJa}${e.firstNameJa}`,
      fullNameSpaced: `${e.lastNameJa} ${e.firstNameJa}`,
    }));

    for (const b of branches) {
      if (!b.nameJa) continue;

      // Manager / Sub Manager を Employee 名で検索（スペース有無両方に対応）
      const findEmployee = (name: string | null) => {
        if (!name) return null;
        const trimmed = name.trim();
        return employeeFullNames.find(
          e => e.fullName === trimmed || e.fullNameSpaced === trimmed
        );
      };
      const manager = findEmployee(b.managerName);
      const subManager = findEmployee(b.subManagerName);

      // openDate パース
      let openDate: Date | null = null;
      if (b.openDate) {
        const d = new Date(b.openDate);
        if (!isNaN(d.getTime())) openDate = d;
      }

      // 既存支店を nameJa で検索（重複防止）
      const existing = await prisma.branch.findFirst({
        where: { nameJa: b.nameJa },
      });

      const data: any = {
        nameJa: b.nameJa,
        nameEn: b.nameEn || b.nameJa,
        postalCode: b.postalCode || null,
        address: b.address || null,
        addressEn: b.addressEn || null,
        googleMapUrl: b.googleMapUrl || null,
        closedDays: b.closedDays || null,
        openDate: openDate,
        openingTime: b.openTime || null,
        closingTime: b.closeTime || null,
      };

      if (manager) data.manager1Id = manager.id;
      if (subManager) data.manager2Id = subManager.id;

      if (existing) {
        await prisma.branch.update({
          where: { id: existing.id },
          data,
        });
        updatedCount++;
      } else {
        await prisma.branch.create({ data });
        importedCount++;
      }
    }

    return NextResponse.json({ success: true, count: importedCount, updatedCount });
  } catch (error) {
    console.error('Branch Import Error:', error);
    return NextResponse.json({ error: 'Failed to import branches' }, { status: 500 });
  }
}
