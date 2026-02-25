import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateUniqueCustomerCode } from '@/lib/customerCode';


export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const code = await generateUniqueCustomerCode(prisma, 'TS');
  return NextResponse.json({ code });
}
