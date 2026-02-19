import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseDate = (d: any) => d ? new Date(d) : null;
const parseFloatSafe = (n: any) => n ? parseFloat(n) : null;
const parseIntSafe = (n: any) => n ? parseInt(n, 10) : null;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.flyerDistributor.update({
      where: { id: parseInt(id) },
      data: {
        branchId: parseIntSafe(body.branchId),
        countryId: parseIntSafe(body.countryId),
        staffId: body.staffId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        birthday: parseDate(body.birthday),
        gender: body.gender,
        address: body.address,
        visaType: body.visaType,
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