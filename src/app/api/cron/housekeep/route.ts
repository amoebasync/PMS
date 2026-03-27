import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';

const CRON_SECRET = process.env.CRON_SECRET;

// アーカイブ処理のバッチサイズ
const AUDIT_BATCH_SIZE = 1000;  // 監査ログ（JSONが重いため小さめ）
const GPS_BATCH_SIZE = 10000;   // GPS座標（軽量レコード）
const INSPECTION_GPS_BATCH_SIZE = 10000; // 巡回GPS座標

// 保持期間（日数）
const RETENTION_DAYS = {
  notifications: 30,
  auditLogs: 90,
  gpsPoints: 365,
  inspectionGps: 365,
  passwordTokens: 7,        // 期限切れトークンは7日後に削除
  pickingVerifications: 365, // ピッキング写真は1年保持
  interviewSlots: 730,       // 面接スロットは2年保持
  trainingSlots: 730,        // 研修スロットは2年保持
  progressEvents: 365,       // 配布セッション関連は1年
  skipEvents: 365,
  pauseEvents: 365,
};

// GET /api/cron/housekeep
// CRON: データハウスキープ（毎日 03:00 実行）
//
// 処理内容:
//   1. admin_notifications:     30日超の通知を削除
//   2. audit_logs:              90日超をS3アーカイブ後削除
//   3. gps_points:              365日超をS3アーカイブ後削除
//   4. inspection_gps_points:   365日超をS3アーカイブ後削除
//   5. password_reset_tokens:   期限切れ7日超を削除
//   6. picking_verifications:   365日超の写真をS3から削除 + レコード削除
//   7. interview_slots:         2年超の未予約スロットを削除
//   8. training_slots:          2年超の未参加スロットを削除
//   9. progress/skip/pause_events: 365日超を削除（GPSと同期）
//
// S3保存先:
//   archives/audit-logs/{YYYY-MM}/audit-{timestamp}-{firstId}.jsonl
//   archives/gps-points/{YYYY-MM}/gps-{timestamp}-{firstId}.jsonl
//   archives/inspection-gps/{YYYY-MM}/igps-{timestamp}-{firstId}.jsonl
//
// アーカイブ後のS3ライフサイクル（AWSコンソールで設定推奨）:
//   audit-logs → 5年 (内部統制法要件)
//   gps-points → 1年
//   inspection-gps → 1年

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
    const cutoff = new Date(Date.now() - RETENTION_DAYS.notifications * 24 * 60 * 60 * 1000);
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
    const cutoff = new Date(Date.now() - RETENTION_DAYS.auditLogs * 24 * 60 * 60 * 1000);
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
    const cutoff = new Date(Date.now() - RETENTION_DAYS.gpsPoints * 24 * 60 * 60 * 1000);
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

  // ─────────────────────────────────────────────
  // 4. inspection_gps_points: 365日超をS3アーカイブ → DB削除
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS.inspectionGps * 24 * 60 * 60 * 1000);
    let totalArchived = 0;

    while (true) {
      const batch = await prisma.inspectionGpsPoint.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { id: 'asc' },
        take: INSPECTION_GPS_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      const jsonl = batch.map(r => JSON.stringify(r)).join('\n');
      const yearMonth = batch[0].createdAt.toISOString().slice(0, 7);
      const s3Key = `archives/inspection-gps/${yearMonth}/igps-${Date.now()}-${batch[0].id}.jsonl`;

      await uploadToS3(Buffer.from(jsonl, 'utf-8'), s3Key, 'application/x-ndjson');

      const ids = batch.map(r => r.id);
      await prisma.inspectionGpsPoint.deleteMany({ where: { id: { in: ids } } });
      totalArchived += batch.length;
    }

    results.inspectionGpsPoints = { archived: totalArchived };
    console.log(`[Housekeep] inspection_gps_points: ${totalArchived}件アーカイブ`);
  } catch (err) {
    console.error('[Housekeep] inspection_gps_points エラー:', err);
    results.inspectionGpsPoints = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 5. password_reset_tokens: 期限切れ7日超を削除
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS.passwordTokens * 24 * 60 * 60 * 1000);
    const { count } = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { usedAt: { not: null, lt: cutoff } },
        ],
      },
    });
    results.passwordResetTokens = { deleted: count };
    console.log(`[Housekeep] password_reset_tokens: ${count}件削除`);
  } catch (err) {
    console.error('[Housekeep] password_reset_tokens エラー:', err);
    results.passwordResetTokens = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 6. picking_verifications: 365日超を削除（S3写真も削除）
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS.pickingVerifications * 24 * 60 * 60 * 1000);
    // まず S3 写真URLを取得してから削除
    const oldRecords = await prisma.pickingVerification.findMany({
      where: { pickedAt: { lt: cutoff } },
      select: { id: true, photoUrl: true },
      take: 1000,
    });

    if (oldRecords.length > 0) {
      // S3写真の削除（エラーでも続行）
      for (const rec of oldRecords) {
        if (rec.photoUrl) {
          try {
            const { deleteFromS3 } = await import('@/lib/s3');
            // S3 URLからキーを抽出
            const url = new URL(rec.photoUrl);
            const key = url.pathname.replace(/^\//, '');
            await deleteFromS3(key);
          } catch { /* S3削除失敗は無視 */ }
        }
      }

      const ids = oldRecords.map(r => r.id);
      await prisma.pickingVerification.deleteMany({ where: { id: { in: ids } } });
    }

    results.pickingVerifications = { deleted: oldRecords.length };
    console.log(`[Housekeep] picking_verifications: ${oldRecords.length}件削除`);
  } catch (err) {
    console.error('[Housekeep] picking_verifications エラー:', err);
    results.pickingVerifications = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 7. interview_slots: 2年超の未予約スロットを削除
  //    応募者が紐付いているスロットはスキップ
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS.interviewSlots * 24 * 60 * 60 * 1000);
    const { count } = await prisma.interviewSlot.deleteMany({
      where: {
        endTime: { lt: cutoff },
        isBooked: false,
      },
    });
    results.interviewSlots = { deleted: count };
    console.log(`[Housekeep] interview_slots (未予約): ${count}件削除`);
  } catch (err) {
    console.error('[Housekeep] interview_slots エラー:', err);
    results.interviewSlots = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 8. training_slots: 2年超で応募者ゼロのスロットを削除
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS.trainingSlots * 24 * 60 * 60 * 1000);
    const { count } = await prisma.trainingSlot.deleteMany({
      where: {
        endTime: { lt: cutoff },
        applicants: { none: {} },
      },
    });
    results.trainingSlots = { deleted: count };
    console.log(`[Housekeep] training_slots (未参加): ${count}件削除`);
  } catch (err) {
    console.error('[Housekeep] training_slots エラー:', err);
    results.trainingSlots = { error: String(err) };
  }

  // ─────────────────────────────────────────────
  // 9. progress_events / skip_events / pause_events: 365日超を削除
  //    GPSポイントと同じ保持期間（セッション関連データ）
  // ─────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS.progressEvents * 24 * 60 * 60 * 1000);

    const progressResult = await prisma.progressEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const skipResult = await prisma.skipEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const pauseResult = await prisma.pauseEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    results.sessionEvents = {
      progressDeleted: progressResult.count,
      skipDeleted: skipResult.count,
      pauseDeleted: pauseResult.count,
    };
    console.log(`[Housekeep] session_events: progress=${progressResult.count}, skip=${skipResult.count}, pause=${pauseResult.count}件削除`);
  } catch (err) {
    console.error('[Housekeep] session_events エラー:', err);
    results.sessionEvents = { error: String(err) };
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[Housekeep] 完了 (${elapsedMs}ms):`, JSON.stringify(results));

  return NextResponse.json({
    success: true,
    elapsedMs,
    ...results,
  });
}
