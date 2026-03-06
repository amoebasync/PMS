import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';


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
  try {
    const { id } = await params;
    const body = await request.json();

    // パスワードリセット（誕生日に戻す）が要求された場合
    const passwordData = body.resetPassword
      ? { passwordHash: buildInitialPassword(body.birthday), isPasswordTemp: true }
      : {};

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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.flyerDistributor.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}