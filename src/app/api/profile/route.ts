import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import crypto from 'crypto'; // ★ 追加: パスワードを暗号化(ハッシュ化)するためのライブラリ


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
        country: true,
        visaType: true,
        financial: true,
        manager: { select: { id: true, lastNameJa: true, firstNameJa: true, jobTitle: true, avatarUrl: true } },
        subordinates: {
          where: { isActive: true },
          orderBy: { lastNameJa: 'asc' },
          select: { id: true, lastNameJa: true, firstNameJa: true, jobTitle: true, avatarUrl: true, rank: true }
        }
      }
    });

    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { passwordHash, ...safeData } = employee; 
    return NextResponse.json(safeData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// 上司変更 (PATCH) — HR_ADMIN / SUPER_ADMIN のみ
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const empId = parseInt(sessionId);

    // 権限チェック: SUPER_ADMIN または HR_ADMIN のみ許可
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { roles: { include: { role: true } } }
    });
    const isAuthorized = currentEmployee?.roles.some(
      (r) => r.role.code === 'SUPER_ADMIN' || r.role.code === 'HR_ADMIN'
    );
    if (!isAuthorized) {
      return NextResponse.json({ error: '権限がありません。人事管理者またはスーパー管理者のみ変更できます。' }, { status: 403 });
    }

    const { managerId } = await request.json();

    await prisma.employee.update({
      where: { id: empId },
      data: { managerId: managerId ? parseInt(managerId) : null }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update Manager Error:', error);
    return NextResponse.json({ error: 'Failed to update manager' }, { status: 500 });
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
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
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