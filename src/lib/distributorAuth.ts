import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getDistributorFromCookie() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_distributor_session')?.value;
  if (!sessionId) return null;

  const id = parseInt(sessionId);
  if (isNaN(id)) return null;

  const distributor = await prisma.flyerDistributor.findUnique({
    where: { id },
  });

  return distributor;
}
