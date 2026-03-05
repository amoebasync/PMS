import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';

const CRON_SECRET = process.env.CRON_SECRET;

// アーカイブ処理のバッチサイズ
const AUDIT_BATCH_SIZE = 1000;  // 監査ログ（JSONが重いため小さめ）
const GPS_BATCH_SIZE = 10000;   // GPS座標（軽量レコード）

// GET /api/cron/housekeep
// CRON: データハウスキープ（毎日 03:00 実行）
//
// 処理内容:
//   1. admin_notifications: 30日超の既読済み通知を削除
//   2. audit_logs:          90日超のレコードをS3 (archives/audit-logs/) にJSONLアーカイブ後 DB削除
//   3. gps_points:          365日超のレコードをS3 (archives/gps-points/) にJSONLアーカイブ後 DB削除
//
// S3保存先:
//   archives/audit-logs/{YYYY-MM}/audit-{timestamp}-{firstId}.jsonl
//   archives/gps-points/{YYYY-MM}/gps-{timestamp}-{firstId}.jsonl
//
// アーカイブ後のS3ライフサイクル（AWSコンソールで設定推奨）:
//   audit-logs → 5年 (内部統制法要件)
//   gps-points → 1年

export async function GET(request: Request) {
  // 2台構成の重複実行防止: CRON_PRIMARY=true のサーバーのみ実行
  if (process.env.CRON_PRIMARY !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'not primary' });
  }

  // Bearer トークン認証
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const startedAt = Date.now();

  // ─────────────────────────────────────────────
  // 1. admin_notifications: 30日超を削除
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await prisma.adminNotification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.adminNotifications = { deleted: count };
    console.log(`[Housekeep] admin_notifications: ${count}件削除`);
  } catch (err) {
    console.error('[Housekeep] admin_notifications エラー:', err);
    results.adminNotifications = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 2. audit_logs: 90日超をS3アーカイブ → DB削除
  //    アーカイブ成功後にのみDB削除するため、S3障害でもデータ損失なし
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let totalArchived = 0;

    while (true) {
      const batch = await prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { id: 'asc' },
        take: AUDIT_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      // JSONL形式（1行 = 1レコード）でS3に保存
      const jsonl = batch.map(r => JSON.stringify(r)).join('\n');
      const yearMonth = batch[0].createdAt.toISOString().slice(0, 7); // "YYYY-MM"
      const s3Key = `archives/audit-logs/${yearMonth}/audit-${Date.now()}-${batch[0].id}.jsonl`;

      await uploadToS3(Buffer.from(jsonl, 'utf-8'), s3Key, 'application/x-ndjson');

      // S3保存成功後にDB削除
      const ids = batch.map(r => r.id);
      await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
      totalArchived += batch.length;
    }

    results.auditLogs = { archived: totalArchived };
    console.log(`[Housekeep] audit_logs: ${totalArchived}件アーカイブ`);
  } catch (err) {
    console.error('[Housekeep] audit_logs エラー:', err);
    results.auditLogs = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 3. gps_points: 365日超をS3アーカイブ → DB削除
  //    10,000件バッチで処理（メモリ効率化）
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    let totalArchived = 0;

    while (true) {
      const batch = await prisma.gpsPoint.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { id: 'asc' },
        take: GPS_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      const jsonl = batch.map(r => JSON.stringify(r)).join('\n');
      const yearMonth = batch[0].createdAt.toISOString().slice(0, 7);
      const s3Key = `archives/gps-points/${yearMonth}/gps-${Date.now()}-${batch[0].id}.jsonl`;

      await uploadToS3(Buffer.from(jsonl, 'utf-8'), s3Key, 'application/x-ndjson');

      const ids = batch.map(r => r.id);
      await prisma.gpsPoint.deleteMany({ where: { id: { in: ids } } });
      totalArchived += batch.length;
    }

    results.gpsPoints = { archived: totalArchived };
    console.log(`[Housekeep] gps_points: ${totalArchived}件アーカイブ`);
  } catch (err) {
    console.error('[Housekeep] gps_points エラー:', err);
    results.gpsPoints = { error: String(err) };
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[Housekeep] 完了 (${elapsedMs}ms):`, JSON.stringify(results));

  return NextResponse.json({
    success: true,
    elapsedMs,
    ...results,
  });
}
