import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyPassword, hashPassword } from '@/lib/password';
import { writeAuditLog, getIpAddress } from '@/lib/audit';


export async function POST(request: Request) {
  const ip = getIpAddress(request);
  const ua = request.headers.get('user-agent');

  try {
    const body = await request.json();
    const { accountId, password } = body;

    if (!accountId || !password) {
      return NextResponse.json({ error: 'IDとパスワードを入力してください' }, { status: 400 });
    }

    // 1. メールアドレスまたは社員コードでアカウントを検索
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { email: accountId },
          { employeeCode: accountId },
        ],
        isActive: true,
      },
    });

    if (!employee) {
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        action: 'LOGIN_FAILURE',
        targetModel: 'Employee',
        description: `ログイン失敗: アカウントID="${accountId}"（ユーザー不存在）`,
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: 'IDまたはパスワードが間違っています。' }, { status: 401 });
    }

    // 2. パスワードを検証（bcrypt / SHA-256 両対応）
    const { verified, needsUpgrade } = await verifyPassword(password, employee.passwordHash);
    if (!verified) {
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId: employee.id,
        actorName: `${employee.lastNameJa} ${employee.firstNameJa}`,
        action: 'LOGIN_FAILURE',
        targetModel: 'Employee',
        targetId: employee.id,
        description: 'ログイン失敗: パスワード不一致',
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: 'IDまたはパスワードが間違っています。' }, { status: 401 });
    }

    // 3. SHA-256ハッシュの場合はbcryptに自動アップグレード
    if (needsUpgrade) {
      const newHash = await hashPassword(password);
      await prisma.employee.update({ where: { id: employee.id }, data: { passwordHash: newHash } });
    }

    // 4. 認証成功: Cookieにセッション情報を保存 (Next.js 15+ の書き方)
    const cookieStore = await cookies();
    cookieStore.set('pms_session', employee.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7日間有効
    });

    // 初回ログイン / 仮パスワードの場合: 強制変更フラグ Cookie をセット
    if (employee.mustChangePassword) {
      cookieStore.set('pms_force_pw_change', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 // 24時間（変更完了で消去）
      });
    }

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId: employee.id,
      actorName: `${employee.lastNameJa} ${employee.firstNameJa}`,
      action: 'LOGIN_SUCCESS',
      targetModel: 'Employee',
      targetId: employee.id,
      description: '管理者ログイン成功',
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({
      success: true,
      user: { name: employee.lastNameJa },
      mustChangePassword: employee.mustChangePassword,
    });

  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}