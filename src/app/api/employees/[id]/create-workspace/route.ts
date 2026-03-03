import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isGoogleWorkspaceConfigured, generateUniqueEmail, createWorkspaceUser } from '@/lib/google-workspace';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const { actorId, actorName } = await getAdminActorInfo();
  const ip = getIpAddress(request);

  try {
    const { id } = await params;
    const empId = parseInt(id);
    if (isNaN(empId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) {
      return NextResponse.json({ error: '社員が見つかりません' }, { status: 404 });
    }

    // 既に @tiramis.co.jp の場合はスキップ
    if (employee.email.endsWith('@tiramis.co.jp')) {
      return NextResponse.json({ error: 'この社員には既にWorkspaceアカウントが設定されています' }, { status: 400 });
    }

    // 英語名が必須
    if (!employee.firstNameEn || !employee.lastNameEn) {
      return NextResponse.json({ error: '英語名（First Name / Last Name）が未設定です。先に社員情報を編集してください' }, { status: 400 });
    }

    if (!isGoogleWorkspaceConfigured()) {
      return NextResponse.json({ error: 'Google Workspace APIが設定されていません' }, { status: 500 });
    }

    // メールアドレス生成
    const workspaceEmail = await generateUniqueEmail(employee.firstNameEn, employee.lastNameEn);

    // 初期パスワード = 生年月日 YYYYMMDD
    const birthdayStr = employee.birthday
      ? new Date(employee.birthday).toISOString().slice(0, 10).replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Workspace ユーザー作成
    const wsResult = await createWorkspaceUser(
      workspaceEmail,
      employee.firstNameEn,
      employee.lastNameEn,
      birthdayStr,
    );
    if (!wsResult.success) {
      return NextResponse.json({ error: `Workspaceアカウントの作成に失敗しました: ${wsResult.error}` }, { status: 500 });
    }

    // 旧メールを personalEmail に保存（未設定の場合のみ）、新メールを email にセット
    const beforeEmployee = { ...employee };
    const updated = await prisma.employee.update({
      where: { id: empId },
      data: {
        email: workspaceEmail,
        personalEmail: employee.personalEmail || employee.email,
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'UPDATE',
      targetModel: 'Employee',
      targetId: empId,
      beforeData: beforeEmployee as unknown as Record<string, unknown>,
      afterData: updated as unknown as Record<string, unknown>,
      ipAddress: ip,
      description: `社員「${employee.lastNameJa} ${employee.firstNameJa}」にWorkspaceアカウント作成: ${workspaceEmail}`,
    });

    return NextResponse.json({
      success: true,
      email: workspaceEmail,
      personalEmail: updated.personalEmail,
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Workspaceアカウントの作成に失敗しました' }, { status: 500 });
  }
}
