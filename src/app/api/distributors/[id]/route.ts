import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { removeFromGoogleGroup, isGooglePlayTesterConfigured } from '@/lib/google-play-tester';
import { removeBetaTester, isAppStoreConnectConfigured } from '@/lib/appstore-connect';
import { requireAdminSession } from '@/lib/adminAuth';
import { isPostingSystemSyncConfigured, syncStaffToPostingSystem, syncStaffRatesToPostingSystem } from '@/lib/posting-system-sync';


const parseDate = (d: any) => d ? new Date(d) : null;
const parseFloatSafe = (n: any) => n ? parseFloat(n) : null;
const parseIntSafe = (n: any) => n ? parseInt(n, 10) : null;

function buildInitialPassword(birthday: string | null | undefined): string | null {
  if (!birthday) return null;
  const d = new Date(birthday);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return crypto.createHash('sha256').update(`${y}${m}${day}`).digest('hex');
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const distId = parseInt(id);

    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distId },
      include: {
        branch: true, country: true, visaType: true,
        _count: {
          select: {
            schedules: { where: { status: 'COMPLETED' } },
            tasks: { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } },
          },
        },
      },
    });
    if (!distributor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { passwordHash, ...safe } = distributor;

    // 累計出勤日数: 同日に複数スケジュールがあっても1日=1出勤
    const daysResult = await prisma.$queryRaw<[{ days: bigint }]>`
      SELECT COUNT(DISTINCT DATE(date)) as days
      FROM distribution_schedules
      WHERE distributor_id = ${distId} AND status = 'COMPLETED'
    `;
    const totalWorkDays = Number(daysResult[0]?.days ?? 0);

    // 平均配布率: AVG(actualCount / plannedCount) for this distributor's items
    // planned_count = 1 のダミーデータは除外
    const rateResult = await prisma.$queryRaw<[{ avgRate: number | null }]>`
      SELECT AVG(di.actual_count / di.planned_count) as avgRate
      FROM distribution_items di
      JOIN distribution_schedules ds ON ds.id = di.schedule_id
      WHERE ds.distributor_id = ${distId}
        AND di.planned_count > 1 AND di.actual_count IS NOT NULL
    `;
    const avgDistributionRate = rateResult[0]?.avgRate != null
      ? Math.round(rateResult[0].avgRate * 1000) / 10
      : null;

    // Check if AI verification is enabled
    const aiVerificationSetting = await prisma.systemSetting.findUnique({
      where: { key: 'residenceCardAiVerification' },
    });
    const aiVerificationEnabled = aiVerificationSetting?.value === 'true';

    return NextResponse.json({ ...safe, aiVerificationEnabled, avgDistributionRate, totalWorkDays });
  } catch (error) {
    console.error('Get Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();

    // パスワードリセット（誕生日に戻す）が要求された場合
    const passwordData = body.resetPassword
      ? { passwordHash: buildInitialPassword(body.birthday), isPasswordTemp: true }
      : {};

    // 退職処理: leaveDate が新たに設定された場合、テスターリストから自動削除
    const isSettingLeaveDate = body.leaveDate && !body._skipGroupRemoval;
    if (isSettingLeaveDate) {
      const current = await prisma.flyerDistributor.findUnique({
        where: { id: parseInt(id) },
        select: { leaveDate: true },
      });
      if (!current?.leaveDate) {
        // 新たに退職日が設定された → 配信済みメールを全て削除
        const sentLogs = await prisma.appDistributionLog.findMany({
          where: { distributorId: parseInt(id), status: 'SENT' },
          select: { email: true, platform: true },
          distinct: ['email', 'platform'],
        });
        for (const log of sentLogs) {
          if (log.platform === 'ANDROID' && isGooglePlayTesterConfigured()) {
            removeFromGoogleGroup(log.email).catch(err =>
              console.error(`[AppDist] Failed to remove ${log.email} from Google Group:`, err)
            );
          }
          if (log.platform === 'APPLE' && isAppStoreConnectConfigured()) {
            removeBetaTester(log.email).catch(err =>
              console.error(`[AppDist] Failed to remove ${log.email} from TestFlight:`, err)
            );
          }
        }
      }
    }

    const updated = await prisma.flyerDistributor.update({
      where: { id: parseInt(id) },
      data: {
        branchId: parseIntSafe(body.branchId),
        countryId: parseIntSafe(body.countryId),
        visaTypeId: parseIntSafe(body.visaTypeId),
        staffId: body.staffId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        birthday: parseDate(body.birthday),
        gender: body.gender,
        postalCode: body.postalCode,
        address: body.address,
        buildingName: body.buildingName,
        ...passwordData,
        visaExpiryDate: parseDate(body.visaExpiryDate),
        hasAgreedPersonalInfo: Boolean(body.hasAgreedPersonalInfo),
        hasSignedContract: Boolean(body.hasSignedContract),
        hasResidenceCard: Boolean(body.hasResidenceCard),
        joinDate: parseDate(body.joinDate),
        leaveDate: parseDate(body.leaveDate),
        leaveReason: body.leaveReason,
        leaveType: body.leaveType || null,
        paymentMethod: body.paymentMethod,
        bankName: body.bankName,
        bankBranchCode: body.bankBranchCode,
        bankAccountType: body.bankAccountType,
        bankAccountNumber: body.bankAccountNumber,
        bankAccountName: body.bankAccountName,
        bankAccountNameKana: body.bankAccountNameKana,
        transferNumber: body.transferNumber,
        equipmentBattery: body.equipmentBattery,
        equipmentBag: body.equipmentBag,
        equipmentMobile: body.equipmentMobile,
        flyerDeliveryMethod: body.flyerDeliveryMethod,
        transportationMethod: body.transportationMethod,
        ratePlan: body.ratePlan,
        rate1Type: parseFloatSafe(body.rate1Type),
        rate2Type: parseFloatSafe(body.rate2Type),
        rate3Type: parseFloatSafe(body.rate3Type),
        rate4Type: parseFloatSafe(body.rate4Type),
        rate5Type: parseFloatSafe(body.rate5Type),
        rate6Type: parseFloatSafe(body.rate6Type),
        transportationFee: body.transportationFee,
        trainingAllowance: body.trainingAllowance,
        rank: body.rank,
        attendanceCount: parseIntSafe(body.attendanceCount) || 0,
        minTypes: parseIntSafe(body.minTypes),
        maxTypes: parseIntSafe(body.maxTypes),
        minSheets: parseIntSafe(body.minSheets),
        maxSheets: parseIntSafe(body.maxSheets),
        targetAmount: body.targetAmount,
        rateMode: body.rateMode || 'manual',
        note: body.note,
        language: body.language || 'ja',
      },
    });

    // Posting System 同期（fire-and-forget）
    if (isPostingSystemSyncConfigured()) {
      // 基本情報（電話番号・名前）
      if (body.phone !== undefined) {
        syncStaffToPostingSystem({
          staffCd: updated.staffId,
          staffName: updated.name,
          staffTel: updated.phone || '',
          shopCd: '',
          joinDate: '',
        }).catch(err => console.error('[PostingSync] Failed to sync phone update:', err));
      }

      // 単価同期
      if (body.rate1Type !== undefined || body.rate2Type !== undefined ||
          body.rate3Type !== undefined || body.rate4Type !== undefined ||
          body.rate5Type !== undefined || body.rate6Type !== undefined) {
        syncStaffRatesToPostingSystem({
          staffCd: updated.staffId,
          rate1: updated.rate1Type,
          rate2: updated.rate2Type,
          rate3: updated.rate3Type,
          rate4: updated.rate4Type,
          rate5: updated.rate5Type,
          rate6: updated.rate6Type,
        }).catch(err => console.error('[PostingSync] Failed to sync rate update:', err));
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const distId = parseInt(id);

    // 削除前にGoogleグループから配信済みメールを全て削除
    if (isGooglePlayTesterConfigured()) {
      const sentLogs = await prisma.appDistributionLog.findMany({
        where: { distributorId: distId, platform: 'ANDROID', status: 'SENT' },
        select: { email: true },
        distinct: ['email'],
      });
      for (const log of sentLogs) {
        await removeFromGoogleGroup(log.email).catch(err =>
          console.error(`[AppDist] Failed to remove ${log.email} from Google Group:`, err)
        );
      }
    }

    await prisma.flyerDistributor.delete({
      where: { id: distId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}