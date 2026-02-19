import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 部署、役職、国 をまとめて取得
    const [departments, roles, countries] = await Promise.all([
      prisma.department.findMany({ orderBy: { id: 'asc' } }),
      prisma.role.findMany({ orderBy: { id: 'asc' } }),
      prisma.country.findMany({ orderBy: { id: 'asc' } }) // ★これが重要
    ]);

    return NextResponse.json({ departments, roles, countries });
  } catch (error) {
    console.error('Master Data Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch masters' }, { status: 500 });
  }
}