import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        branch: true,
        department: true,
        roles: { include: { role: true } }, // ★ 変更: 中間テーブル経由でロール情報を取得
        financial: true, 
      }
    });

    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { passwordHash, ...safeData } = employee; 
    return NextResponse.json(safeData);
  } catch (error) {
    console.error('Fetch Profile Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const empId = parseInt(sessionId);

    const result = await prisma.$transaction(async (tx) => {
      const updatedEmp = await tx.employee.update({
        where: { id: empId },
        data: {
          lastNameJa: body.lastNameJa,
          firstNameJa: body.firstNameJa,
          lastNameEn: body.lastNameEn,
          firstNameEn: body.firstNameEn,
          email: body.email,
          phone: body.phone,
          avatarUrl: body.avatarUrl,
        }
      });

      const financialData: any = {
        bankId: body.bankId ? parseInt(body.bankId, 10) : null,
        branchName: body.branchName || null,
        branchCode: body.branchCode || null,
        accountType: body.accountType || 'ORDINARY',
        accountNumber: body.accountNumber || null,
        accountName: body.accountName || null,
        accountNameKana: body.accountNameKana || null,
      };

      await tx.employeeFinancial.upsert({
        where: { employeeId: empId },
        update: financialData,     
        create: { employeeId: empId, ...financialData }
      });

      return updatedEmp;
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}