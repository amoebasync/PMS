import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// PrismaClientのインスタンス作成（シングルトン推奨だが簡易的に）
const prisma = new PrismaClient();

export async function GET() {
  const start = Date.now();
  
  try {
    // データベースに軽いクエリを投げる (SELECT 1)
    await prisma.$queryRaw`SELECT 1`;
    
    const duration = Date.now() - start;
    
    return NextResponse.json({ 
      status: 'ok', 
      db_latency: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database Health Check Failed:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Database Connection Failed' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}