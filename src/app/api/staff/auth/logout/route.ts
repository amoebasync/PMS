import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { writeAuditLog } from '@/lib/audit';

export async function POST() {
  // Cookie削除前にアクター情報を取得する（CLAUDE.md 仕様）
  const distributor = await getDistributorFromCookie();

  const cookieStore = await cookies();
  cookieStore.delete('pms_distributor_session');

  // 監査ログ記録（txなし：ログ失敗でもログアウト処理を止めないため）
  await writeAuditLog({
    actorType: 'STAFF',
    actorId: distributor?.id ?? null,
    actorName: distributor?.name ?? null,
    action: 'LOGOUT',
    targetModel: 'FlyerDistributor',
    targetId: distributor?.id ?? null,
    description: distributor ? `配布員ログアウト: ${distributor.name}` : '配布員ログアウト（セッション情報なし）',
  });

  return NextResponse.json({ success: true });
}
