import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAlert } from '@/lib/alerts';

// GET /api/cron/check-visa-expiry
// CRON: ビザ期限30日以内チェック（Bearer CRON_SECRET 認証）
export async function GET(request: Request) {
  // 2台構成の重複実行防止: CRON_PRIMARY=true のサーバーのみ実行
  if (process.env.CRON_PRIMARY !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'not primary' });
  }

  // Bearer CRON_SECRET 認証
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    // 在職中で visaExpiryDate が 30 日以内の配布員を検索
    const distributors = await prisma.flyerDistributor.findMany({
      where: {
        leaveDate: null,
        visaExpiryDate: {
          lte: thirtyDaysLater,
        },
      },
      select: {
        id: true,
        name: true,
        staffId: true,
        visaExpiryDate: true,
      },
    });

    // 「配布員」カテゴリのIDを取得
    const category = await prisma.alertCategory.findFirst({
      where: { name: '配布員' },
    });
    if (!category) {
      return NextResponse.json({ error: 'アラートカテゴリ「配布員」が見つかりません' }, { status: 500 });
    }

    let created = 0;
    for (const dist of distributors) {
      if (!dist.visaExpiryDate) continue;

      const daysRemaining = Math.ceil(
        (dist.visaExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let severity: 'CRITICAL' | 'WARNING' | 'INFO';
      let titlePrefix: string;

      if (daysRemaining <= 0) {
        severity = 'CRITICAL';
        titlePrefix = 'ビザ期限超過';
      } else if (daysRemaining <= 7) {
        severity = 'CRITICAL';
        titlePrefix = 'ビザ期限7日以内';
      } else if (daysRemaining <= 14) {
        severity = 'WARNING';
        titlePrefix = 'ビザ期限14日以内';
      } else {
        severity = 'INFO';
        titlePrefix = 'ビザ期限30日以内';
      }

      const expiryStr = dist.visaExpiryDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
      const staffLabel = dist.staffId ? `[${dist.staffId}]` : '';

      await createAlert({
        categoryId: category.id,
        severity,
        title: `${titlePrefix}: ${staffLabel}${dist.name}`,
        message: `ビザ有効期限: ${expiryStr}（残り${daysRemaining <= 0 ? '超過' : daysRemaining + '日'}）`,
        entityType: 'FlyerDistributor',
        entityId: dist.id,
      });
      created++;
    }

    // === 社員のビザ期限チェック ===
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        visaExpiryDate: {
          lte: thirtyDaysLater,
        },
      },
      select: {
        id: true,
        lastNameJa: true,
        firstNameJa: true,
        employeeCode: true,
        visaExpiryDate: true,
      },
    });

    // 「社員」カテゴリの取得（なければ「配布員」カテゴリをフォールバック）
    const employeeCategory = await prisma.alertCategory.findFirst({
      where: { name: '社員' },
    }) || category;

    if (employeeCategory) {
      for (const emp of employees) {
        if (!emp.visaExpiryDate) continue;

        const daysRemaining = Math.ceil(
          (emp.visaExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let severity: 'CRITICAL' | 'WARNING' | 'INFO';
        let titlePrefix: string;

        if (daysRemaining <= 0) {
          severity = 'CRITICAL';
          titlePrefix = 'ビザ期限超過';
        } else if (daysRemaining <= 7) {
          severity = 'CRITICAL';
          titlePrefix = 'ビザ期限7日以内';
        } else if (daysRemaining <= 14) {
          severity = 'WARNING';
          titlePrefix = 'ビザ期限14日以内';
        } else {
          severity = 'INFO';
          titlePrefix = 'ビザ期限30日以内';
        }

        const expiryStr = emp.visaExpiryDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const empLabel = emp.employeeCode ? `[${emp.employeeCode}]` : '';

        await createAlert({
          categoryId: employeeCategory.id,
          severity,
          title: `${titlePrefix}: ${empLabel}${emp.lastNameJa} ${emp.firstNameJa}`,
          message: `ビザ有効期限: ${expiryStr}（残り${daysRemaining <= 0 ? '超過' : daysRemaining + '日'}）`,
          entityType: 'Employee',
          entityId: emp.id,
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: distributors.length + employees.length,
      alertsCreated: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Visa Expiry Check Error:', error);
    return NextResponse.json({ error: 'ビザ期限チェックに失敗しました' }, { status: 500 });
  }
}
