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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // オートコンプリート用: search パラメータがある場合は絞り込みのみ返す
    if (search) {
      const distributors = await prisma.flyerDistributor.findMany({
        where: {
          OR: [
            { name: { contains: search } },
            { staffId: { contains: search } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 10,
        select: { id: true, name: true, staffId: true },
      });
      return NextResponse.json(distributors);
    }

    const distributors = await prisma.flyerDistributor.findMany({
      orderBy: { id: 'desc' },
      include: {
        branch: true,
        country: true,
        visaType: true,
      },
    });
    return NextResponse.json(distributors);
  } catch (error) {
    console.error('Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch distributors' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const passwordHash = buildInitialPassword(body.birthday);

    const newDistributor = await prisma.flyerDistributor.create({
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
        passwordHash,
        isPasswordTemp: true,
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
      },
    });

    return NextResponse.json(newDistributor);
  } catch (error) {
    console.error('Create Error:', error);
    return NextResponse.json({ error: 'Failed to create distributor' }, { status: 500 });
  }
}