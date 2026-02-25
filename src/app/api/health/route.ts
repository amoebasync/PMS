import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


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