import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { sendWorkspaceNotificationEmail } from '@/lib/mailer';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

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

    // @tiramis.co.jp のメールがなければ Workspace アカウントなし
    if (!employee.email.endsWith('@tiramis.co.jp')) {
      return NextResponse.json(
        { error: 'この社員にはWorkspaceアカウント（@tiramis.co.jp）が設定されていません' },
        { status: 400 },
      );
    }

    // 送信先: 私用メールがあればそちら、なければ社用メール
    const toEmail = employee.personalEmail || employee.email;

    // 初期パスワード = 生年月日 (YYYYMMDD)
    const initialPassword = employee.birthday
      ? new Date(employee.birthday).toISOString().slice(0, 10).replace(/-/g, '')
      : '(生年月日が未設定です)';

    await sendWorkspaceNotificationEmail(
      toEmail,
      employee.lastNameJa,
      employee.firstNameJa,
      employee.email,
      initialPassword,
    );

    // 通知日時を記録
    await prisma.employee.update({
      where: { id: empId },
      data: { workspaceNotifiedAt: new Date() },
    });

    return NextResponse.json({ success: true, notifiedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Workspace notification error:', error);
    return NextResponse.json({ error: 'メールの送信に失敗しました' }, { status: 500 });
  }
}
