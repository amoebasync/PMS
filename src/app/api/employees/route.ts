import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto'; // パスワードハッシュ用（簡易）

const prisma = new PrismaClient();

// 一覧取得
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { id: 'desc' },
      include: {
        department: true,
        role: true,
        country: true, // ★国情報も含める
      }
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// 新規登録 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const hash = crypto.createHash('sha256').update(body.password || 'password123').digest('hex');

    const newEmployee = await prisma.employee.create({
      data: {
        // ... (これまでのフィールドはそのまま) ...
        employeeCode: body.employeeCode,
        lastNameJa: body.lastNameJa,
        firstNameJa: body.firstNameJa,
        lastNameKana: body.lastNameKana,
        firstNameKana: body.firstNameKana,
        email: body.email,
        passwordHash: hash,
        hireDate: new Date(body.hireDate), 
        birthday: body.birthday ? new Date(body.birthday) : null,
        gender: body.gender || 'unknown',
        isActive: true,
        
        // 外部キー登録処理 (IDをIntに変換)
        departmentId: body.departmentId ? parseInt(body.departmentId) : null,
        roleId: body.roleId ? parseInt(body.roleId) : null,
        countryId: body.countryId ? parseInt(body.countryId) : null, // ★追加
      },
    });
    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error('Create Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } } // Next.js 15系の場合は await params が必要ですが、14系ならこれでOK
) {
  try {
    const id = parseInt(params.id);

    console.log(`Attempting to delete employee ID: ${id}`); // ログ出力

    // 【修正】物理削除（delete）ではなく、論理削除（update）にする
    const deletedEmployee = await prisma.employee.update({
      where: { id },
      data: { 
        isActive: false, // 退職済フラグを立てる
        // 必要なら退職日も今日にする
        resignationDate: new Date(),
      },
    });

    console.log('Delete (Logical) successful:', deletedEmployee); // 成功ログ

    return NextResponse.json({ message: 'Deleted successfully (Logical)' });
  } catch (error: any) {
    // 【重要】エラーの詳細をコンソールに出す
    console.error('Delete API Error Detail:', error);

    return NextResponse.json(
      { 
        error: 'Failed to delete', 
        details: error.message // フロントエンドにも詳細を返す
      }, 
      { status: 500 }
    );
  }
}