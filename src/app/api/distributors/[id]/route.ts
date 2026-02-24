import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

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
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: parseInt(id) },
      include: { branch: true, country: true, visaType: true },
    });
    if (!distributor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { passwordHash, ...safe } = distributor;
    return NextResponse.json(safe);
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