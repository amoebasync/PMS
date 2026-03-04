import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { sendEmployeeWelcomeEmail } from '@/lib/mailer';
import { hashPassword } from '@/lib/password';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { isGoogleWorkspaceConfigured, generateUniqueEmail, createWorkspaceUser } from '@/lib/google-workspace';


// 一覧取得
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const pageParam = searchParams.get('page');

    // ?search= のみ (pageなし): オートコンプリート用に絞り込んで返す
    if (search && !pageParam) {
      const employees = await prisma.employee.findMany({
        where: {
          isActive: true,
          OR: [
            { lastNameJa: { contains: search } },
            { firstNameJa: { contains: search } },
            { lastNameKana: { contains: search } },
            { firstNameKana: { contains: search } },
            { employeeCode: { contains: search } },
          ]
        },
        take: 10,
        orderBy: { lastNameJa: 'asc' },
        select: { id: true, lastNameJa: true, firstNameJa: true, jobTitle: true, department: { select: { name: true } } }
      });
      return NextResponse.json(employees);
    }

    // ?page= が指定された場合: サーバーサイドフィルタリング + ページネーション
    if (pageParam) {
      const status = searchParams.get('status') || 'ACTIVE';
      const branchId = searchParams.get('branchId') || '';
      const departmentId = searchParams.get('departmentId') || '';
      const page = Math.max(1, parseInt(pageParam));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

      const where: Record<string, unknown> = {};
      if (status === 'ACTIVE') where.isActive = true;
      else if (status === 'INACTIVE') where.isActive = false;
      if (branchId) where.branchId = parseInt(branchId);
      if (departmentId) where.departmentId = parseInt(departmentId);
      if (search) {
        where.OR = [
          { lastNameJa: { contains: search } },
          { firstNameJa: { contains: search } },
          { lastNameKana: { contains: search } },
          { firstNameKana: { contains: search } },
          { employeeCode: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const include = {
        department: true,
        branch: true,
        roles: { include: { role: true } },
        country: true,
        visaType: true,
        financial: true,
        manager: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      };

      const [total, employees] = await Promise.all([
        prisma.employee.count({ where }),
        prisma.employee.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include,
        }),
      ]);

      return NextResponse.json({ data: employees, total, page, totalPages: Math.ceil(total / limit) });
    }

    // ?simple=true: ドロップダウン用の軽量レスポンス（名前・メールのみ）
    const simple = searchParams.get('simple');
    if (simple === 'true') {
      const employees = await prisma.employee.findMany({
        where: { isActive: true },
        orderBy: { lastNameJa: 'asc' },
        select: {
          id: true,
          lastNameJa: true,
          firstNameJa: true,
          email: true,
        },
      });
      return NextResponse.json(employees);
    }

    // パラメーターなし: 全件返す (後方互換・ドロップダウン用)
    const employees = await prisma.employee.findMany({
      orderBy: { id: 'desc' },
      include: {
        department: true,
        branch: true,
        roles: { include: { role: true } },
        country: true,
        visaType: true,
        financial: true,
        manager: { select: { id: true, lastNameJa: true, firstNameJa: true } }
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
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  const { actorId, actorName } = await getAdminActorInfo();
  const ip = getIpAddress(request);

  try {
    const body = await request.json();
    // 初期パスワード = 生年月日 (YYYYMMDD)。未入力の場合は今日の日付をフォールバック
    const birthdayStr = body.birthday
      ? new Date(body.birthday).toISOString().slice(0, 10).replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hash = await hashPassword(birthdayStr);

    // ★ 社員コードが空欄の場合は自動採番する (EMP + 年月日 + 4桁のランダム数字)
    const generatedCode = `EMP${new Date().toISOString().slice(0,10).replace(/-/g, '')}${Math.floor(1000 + Math.random() * 9000)}`;
    const empCode = body.employeeCode || generatedCode;

    // Google Workspace アカウント自動作成
    let workspaceEmail: string | null = null;
    if (body.createWorkspaceAccount) {
      if (!body.firstNameEn || !body.lastNameEn) {
        return NextResponse.json(
          { error: 'Google Workspaceアカウント作成には英語名（名・姓）が必須です' },
          { status: 400 },
        );
      }
      if (!isGoogleWorkspaceConfigured()) {
        return NextResponse.json(
          { error: 'Google Workspace APIが設定されていません。環境変数を確認してください' },
          { status: 500 },
        );
      }

      // メールアドレス生成
      workspaceEmail = await generateUniqueEmail(body.firstNameEn, body.lastNameEn);

      // Workspace ユーザー作成（初期パスワード = 生年月日 YYYYMMDD）
      const wsResult = await createWorkspaceUser(
        workspaceEmail,
        body.firstNameEn,
        body.lastNameEn,
        birthdayStr,
      );
      if (!wsResult.success) {
        return NextResponse.json(
          { error: `Google Workspaceアカウントの作成に失敗しました: ${wsResult.error}` },
          { status: 500 },
        );
      }
    }

    // Workspace作成成功時はそのメールを使用、それ以外はフォームの値を使用
    const employeeEmail = workspaceEmail || body.email;

    const newEmployee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          employeeCode: empCode,
          lastNameJa: body.lastNameJa,
          firstNameJa: body.firstNameJa,
          lastNameKana: body.lastNameKana,
          firstNameKana: body.firstNameKana,
          lastNameEn: body.lastNameEn || null,
          firstNameEn: body.firstNameEn || null,
          email: employeeEmail,
          personalEmail: body.personalEmail || null,
          phone: body.phone || null,
          passwordHash: hash,
          hireDate: body.hireDate ? new Date(body.hireDate) : null,
          birthday: body.birthday ? new Date(body.birthday) : null,
          gender: body.gender || 'unknown',
          isActive: true,
          mustChangePassword: true,
          employmentType: body.employmentType || 'FULL_TIME',
          departmentId: body.departmentId ? parseInt(body.departmentId) : null,
          branchId: body.branchId ? parseInt(body.branchId) : null,
          countryId: body.countryId ? parseInt(body.countryId) : null,
          managerId: body.managerId ? parseInt(body.managerId) : null,
          rank: body.rank || 'ASSOCIATE',
          jobTitle: body.jobTitle || null,
        },
      });

      // 複数ロールの保存処理
      if (body.roleIds && Array.isArray(body.roleIds)) {
        const roleData = body.roleIds.map((rId: string) => ({
          employeeId: emp.id,
          roleId: parseInt(rId)
        }));
        if (roleData.length > 0) {
          await tx.employeeRole.createMany({ data: roleData });
        }
      }

      // 財務・給与情報の作成
      if (body.salaryType) {
        await tx.employeeFinancial.create({
          data: {
            employeeId: emp.id,
            salaryType: body.salaryType || 'MONTHLY',
            baseSalary: body.baseSalary ? parseInt(body.baseSalary) : null,
            hourlyRate: body.hourlyRate ? parseInt(body.hourlyRate) : null,
            dailyRate: body.dailyRate ? parseInt(body.dailyRate) : null,
            paymentMethod: body.paymentMethod || 'BANK_TRANSFER',
            paymentCycle: body.paymentCycle || 'MONTHLY',
            workingWeekdays: body.workingWeekdays || '1,2,3,4,5',
          }
        });
      }

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'Employee',
        targetId: emp.id,
        afterData: emp as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `社員「${emp.lastNameJa} ${emp.firstNameJa}」(${emp.employeeCode})を作成${workspaceEmail ? ` / Workspace: ${workspaceEmail}` : ''}`,
        tx,
      });

      return emp;
    });

    // ウェルカムメール送信（私用メールがあればそちらに、なければ社用メールに送信）
    const welcomeEmailTo = body.personalEmail || employeeEmail;
    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    sendEmployeeWelcomeEmail(
      welcomeEmailTo,
      body.lastNameJa,
      body.firstNameJa,
      newEmployee.employeeCode,
      birthdayStr,
      `${siteUrl}/login`,
    ).catch((err) => console.error('Welcome email failed:', err));

    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error('Create Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}