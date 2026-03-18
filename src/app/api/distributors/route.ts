import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { hashPassword, birthdayToYYYYMMDD } from '@/lib/password';
import { isPostingSystemSyncConfigured, syncStaffToPostingSystem, syncStaffRatesToPostingSystem, branchNameToShopCd } from '@/lib/posting-system-sync';


const parseDate = (d: any) => d ? new Date(d) : null;
const parseFloatSafe = (n: any) => n ? parseFloat(n) : null;
const parseIntSafe = (n: any) => n ? parseInt(n, 10) : null;

async function buildInitialPassword(birthday: string | null | undefined): Promise<string | null> {
  if (!birthday) return null;
  const d = new Date(birthday);
  if (isNaN(d.getTime())) return null;
  return hashPassword(birthdayToYYYYMMDD(d));
}

export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
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
      orderBy: { createdAt: 'desc' },
      include: {
        branch: true,
        country: true,
        visaType: true,
      },
    });

    // 累計出勤日数（1日=1出勤）と平均配布率を一括取得
    const statsRows = await prisma.$queryRaw<{ distributor_id: number; workDays: bigint; avgRate: number | null }[]>`
      SELECT
        ds.distributor_id,
        COUNT(DISTINCT DATE(ds.date)) as workDays,
        AVG(di.actual_count / di.planned_count) as avgRate
      FROM distribution_schedules ds
      LEFT JOIN distribution_items di ON di.schedule_id = ds.id AND di.planned_count > 1 AND di.actual_count IS NOT NULL
      WHERE ds.status = 'COMPLETED' AND ds.distributor_id IS NOT NULL
      GROUP BY ds.distributor_id
    `;
    const statsMap = new Map(statsRows.map(r => [
      r.distributor_id,
      {
        totalWorkDays: Number(r.workDays),
        avgDistributionRate: r.avgRate != null ? Math.round(r.avgRate * 1000) / 10 : null,
      },
    ]));

    const result = distributors.map(d => {
      const stats = statsMap.get(d.id);
      const { passwordHash, ...safe } = d;
      return {
        ...safe,
        totalWorkDays: stats?.totalWorkDays ?? 0,
        avgDistributionRate: stats?.avgDistributionRate ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch distributors' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const body = await request.json();

    const passwordHash = await buildInitialPassword(body.birthday);

    const branchId = parseIntSafe(body.branchId);

    const newDistributor = await prisma.$transaction(async (tx) => {
      const distributor = await tx.flyerDistributor.create({
        data: {
          branchId,
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

      // スタッフIDから番号部分を抽出し、支店のシーケンスを更新
      if (branchId && body.staffId) {
        const numMatch = body.staffId.match(/(\d+)$/);
        if (numMatch) {
          const seqNum = parseInt(numMatch[1], 10);
          const branch = await tx.branch.findUnique({
            where: { id: branchId },
            select: { staffIdSeq: true },
          });
          if (branch && seqNum > (branch.staffIdSeq ?? 0)) {
            await tx.branch.update({
              where: { id: branchId },
              data: { staffIdSeq: seqNum },
            });
          }
        }
      }

      return distributor;
    });

    // Posting System 同期（fire-and-forget）
    if (isPostingSystemSyncConfigured()) {
      // 支店名からPosting System店舗コードを取得
      const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { nameJa: true } }) : null;
      const shopCd = branch?.nameJa ? branchNameToShopCd(branch.nameJa) : '';

      syncStaffToPostingSystem({
        staffCd: newDistributor.staffId,
        staffName: newDistributor.name,
        staffTel: newDistributor.phone || '',
        shopCd,
        joinDate: newDistributor.joinDate
          ? new Date(newDistributor.joinDate).toISOString().slice(0, 10)
          : undefined,
      }).catch(err => console.error('[PostingSync] Failed to sync new staff:', err));

      // 単価同期
      if (body.rate1Type !== undefined || body.rate2Type !== undefined) {
        syncStaffRatesToPostingSystem({
          staffCd: newDistributor.staffId,
          rate1: newDistributor.rate1Type,
          rate2: newDistributor.rate2Type,
          rate3: newDistributor.rate3Type,
          rate4: newDistributor.rate4Type,
          rate5: newDistributor.rate5Type,
          rate6: newDistributor.rate6Type,
        }).catch(err => console.error('[PostingSync] Failed to sync new staff rates:', err));
      }
    }

    return NextResponse.json(newDistributor);
  } catch (error: any) {
    console.error('Create Error:', error);
    if (error?.code === 'P2002' && error?.meta?.target?.includes('staff_id')) {
      return NextResponse.json({ error: 'DUPLICATE_STAFF_ID' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create distributor' }, { status: 500 });
  }
}