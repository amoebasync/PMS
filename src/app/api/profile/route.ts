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
        role: true,
        financial: true, // ★ 追加: DBから口座情報も引っ張ってくる
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

    // ★ 変更: トランザクションを使って Employee と EmployeeFinancial を同時に更新
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Employee (基本情報) の更新
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

      // 2. 登録する口座情報のデータを整形
      const financialData: any = {
        bankId: body.bankId ? parseInt(body.bankId, 10) : null,
        branchName: body.branchName || null,
        branchCode: body.branchCode || null,
        accountType: body.accountType || 'ORDINARY',
        accountNumber: body.accountNumber || null,
        accountName: body.accountName || null,
        accountNameKana: body.accountNameKana || null,
      };

      // 3. EmployeeFinancial (口座情報) の更新または新規作成 (upsert)
      await tx.employeeFinancial.upsert({
        where: { employeeId: empId },
        update: financialData,      // すでにデータがあれば上書き
        create: {                   // データがなければ新規作成
          employeeId: empId,
          ...financialData,
        }
      });

      return updatedEmp;
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}