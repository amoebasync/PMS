import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const prefectures = await prisma.prefecture.findMany({ orderBy: { id: 'asc' } });
    const cities = await prisma.city.findMany({ orderBy: { id: 'asc' } });
    
    // 都道府県の中に紐づく市区町村を入れ込んだ配列を作る
    const result = prefectures.map(pref => ({
      id: pref.id,
      name: pref.name,
      cities: cities.filter(c => c.prefecture_id === pref.id).map(c => ({ id: c.id, name: c.name }))
    })).filter(pref => pref.cities.length > 0); // 登録がある都道府県のみ

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch Locations Error:', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}