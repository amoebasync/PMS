import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// GET /api/applicants
// 管理者: 応募者一覧（ページング+フィルタ）
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const flowStatus = searchParams.get('flowStatus') || '';
    const hiringStatus = searchParams.get('hiringStatus') || '';

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (flowStatus) {
      where.flowStatus = flowStatus;
    }

    if (hiringStatus) {
      where.hiringStatus = hiringStatus;
    }

    const [total, applicants] = await Promise.all([
      prisma.applicant.count({ where }),
      prisma.applicant.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          jobCategory: { select: { id: true, nameJa: true, nameEn: true } },
          country: { select: { id: true, code: true, name: true, nameEn: true } },
          visaType: { select: { id: true, name: true } },
          interviewSlot: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              meetUrl: true,
              isBooked: true,
              interviewer: {
                select: { id: true, lastNameJa: true, firstNameJa: true, email: true },
              },
            },
          },
          recruitingMedia: { select: { id: true, nameJa: true, nameEn: true, code: true } },
          trainingSlot: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              capacity: true,
              location: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: applicants,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Applicants Fetch Error:', error);
    return NextResponse.json({ error: '応募者の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/applicants
// 管理者: 応募者の手動登録（他サイト経由の応募者を手入力で登録）
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, phone, language, jobCategoryId, recruitingMediaId, birthday, gender } = body;

    if (!name || !email || !language || !jobCategoryId) {
      return NextResponse.json({ error: '氏名・メールアドレス・言語・職種は必須です' }, { status: 400 });
    }

    // メール重複チェック
    const existing = await prisma.applicant.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスはすでに登録されています' }, { status: 409 });
    }

    const managementToken = crypto.randomBytes(32).toString('hex');

    const applicant = await prisma.applicant.create({
      data: {
        name,
        email,
        phone: phone || null,
        language: language || 'ja',
        jobCategoryId: Number(jobCategoryId),
        recruitingMediaId: recruitingMediaId ? Number(recruitingMediaId) : null,
        birthday: birthday ? new Date(birthday) : null,
        gender: gender || 'unknown',
        managementToken,
        flowStatus: 'INTERVIEW_WAITING',
        hiringStatus: 'IN_PROGRESS',
      },
      include: {
        jobCategory: { select: { id: true, nameJa: true, nameEn: true } },
      },
    });

    return NextResponse.json(applicant, { status: 201 });
  } catch (error) {
    console.error('Applicant Create Error:', error);
    return NextResponse.json({ error: '応募者の登録に失敗しました' }, { status: 500 });
  }
}
