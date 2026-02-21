import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import crypto from 'crypto'; // ★ 追加: パスワードを暗号化(ハッシュ化)するためのライブラリ

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
        roles: { include: { role: true } }, 
        financial: true, 
        manager: { select: { lastNameJa: true, firstNameJa: true, jobTitle: true } },
        _count: { select: { subordinates: true } } // ★追加: 部下の人数を取得
      }
    });

    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { passwordHash, ...safeData } = employee; 
    return NextResponse.json(safeData);
  } catch (error) {
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
      
      // ★ 追加: 更新するデータをまとめる
      const updateData: any = {
        lastNameJa: body.lastNameJa,
        firstNameJa: body.firstNameJa,
        lastNameEn: body.lastNameEn,
        firstNameEn: body.firstNameEn,
        email: body.email,
        phone: body.phone,
        avatarUrl: body.avatarUrl,
      };

      // ★ 追加: パスワードが入力されている場合のみハッシュ化して更新対象に含める
      if (body.password) {
        updateData.passwordHash = crypto.createHash('sha256').update(body.password).digest('hex');
      }

      // 1. Employee (基本情報・パスワード) の更新
      const updatedEmp = await tx.employee.update({
        where: { id: empId },
        data: updateData
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
        update: financialData,      
        create: {                   
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