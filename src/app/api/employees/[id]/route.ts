import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 更新 (PUT)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ★ Promise型に変更
) {
  try {
    const { id } = await params; // ★ awaitで取り出す（必須）
    const employeeId = parseInt(id);
    
    const body = await request.json();

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeCode: body.employeeCode,
        lastNameJa: body.lastNameJa,
        firstNameJa: body.firstNameJa,
        lastNameKana: body.lastNameKana,
        firstNameKana: body.firstNameKana,
        email: body.email,
        hireDate: new Date(body.hireDate),
        birthday: body.birthday ? new Date(body.birthday) : null, // 追加
        gender: body.gender,
        // 関連付けの更新（IDがある場合のみ）
        departmentId: body.departmentId ? parseInt(body.departmentId) : null,
        roleId: body.roleId ? parseInt(body.roleId) : null,
        countryId: body.countryId ? parseInt(body.countryId) : null,
        isActive: body.isActive,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// 削除 (DELETE) - 論理削除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ★ Promise型に変更
) {
  try {
    const { id } = await params; // ★ awaitで取り出す（必須）
    const employeeId = parseInt(id);

    // 物理削除ではなく、論理削除（ステータス変更）を行う
    await prisma.employee.update({
      where: { id: employeeId },
      data: { 
        isActive: false,
        resignationDate: new Date() // 退職日を記録
      },
    });

    return NextResponse.json({ message: 'Deleted successfully (Logical)' });
  } catch (error) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}