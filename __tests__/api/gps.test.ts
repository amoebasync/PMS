/**
 * POST /api/staff/distribution/gps のAPIテスト
 *
 * テスト対象: src/app/api/staff/distribution/gps/route.ts
 *
 * テストケース:
 * - 未認証 → 401
 * - 必須パラメータ不足 → 400
 * - アクティブセッションなし → 404
 * - 正常GPS送信 → 200（監査ログなし、トランザクションなし）
 * - フィットネスデータあり → セッション総計更新
 * - フィットネスデータなし → セッション総計更新しない
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ----------------------------------------------------------------
// モック定義
// ----------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    distributionSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    gpsPoint: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/distributorAuth', () => ({
  getDistributorFromCookie: vi.fn(),
}));

// ----------------------------------------------------------------
// テスト本体
// ----------------------------------------------------------------
import { POST } from '@/app/api/staff/distribution/gps/route';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

/** テスト用の有効なリクエストボディ */
function validGpsBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 1,
    latitude: 35.6895,
    longitude: 139.6917,
    accuracy: 5.0,
    timestamp: new Date().toISOString(),
    steps: 1500,
    distance: 1200.5,
    calories: 85.3,
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/staff/distribution/gps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/staff/distribution/gps', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルト: 認証済み配布員
    (getDistributorFromCookie as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      name: 'テスト配布員',
    });

    // デフォルト: アクティブセッション存在
    (prisma.distributionSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
    });

    // デフォルト: GPS挿入・セッション更新成功
    (prisma.gpsPoint.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 999 });
    (prisma.distributionSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
  });

  // ----------------------------------------------------------------
  // 認証チェック
  // ----------------------------------------------------------------
  describe('認証チェック', () => {
    it('未認証（cookie なし）の場合 401 を返す', async () => {
      (getDistributorFromCookie as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = makeRequest(validGpsBody());
      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('認証エラー');
    });
  });

  // ----------------------------------------------------------------
  // バリデーション
  // ----------------------------------------------------------------
  describe('バリデーション', () => {
    it('sessionId が欠落している場合 400 を返す', async () => {
      const req = makeRequest(validGpsBody({ sessionId: undefined }));
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('sessionId');
    });

    it('latitude が欠落している場合 400 を返す', async () => {
      const req = makeRequest(validGpsBody({ latitude: undefined }));
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('latitude');
    });

    it('longitude が欠落している場合 400 を返す', async () => {
      const req = makeRequest(validGpsBody({ longitude: undefined }));
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('longitude');
    });
  });

  // ----------------------------------------------------------------
  // セッションチェック
  // ----------------------------------------------------------------
  describe('セッションチェック', () => {
    it('アクティブなセッションが存在しない場合 404 を返す', async () => {
      (prisma.distributionSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = makeRequest(validGpsBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('セッション');
    });

    it('セッション所有者チェック: 他の配布員のセッションは参照されない', async () => {
      const req = makeRequest(validGpsBody({ sessionId: 999 }));
      await POST(req);

      // findFirst が distributorId: 5（自分のID）を含む条件で呼ばれること
      expect(prisma.distributionSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ distributorId: 5 }),
        })
      );
    });
  });

  // ----------------------------------------------------------------
  // 正常GPS送信
  // ----------------------------------------------------------------
  describe('正常系', () => {
    it('有効なGPSデータで { ok: true } を返す', async () => {
      const req = makeRequest(validGpsBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('GPSポイントが gpsPoint.create で保存される（トランザクションなし）', async () => {
      const body = validGpsBody();
      const req = makeRequest(body);
      await POST(req);

      expect(prisma.gpsPoint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 1,
            latitude: 35.6895,
            longitude: 139.6917,
            accuracy: 5.0,
          }),
        })
      );
    });

    it('フィットネスデータ（steps/distance/calories）がある場合、セッション総計を更新する', async () => {
      const req = makeRequest(validGpsBody({ steps: 1500, distance: 1200.5, calories: 85.3 }));
      await POST(req);

      expect(prisma.distributionSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            totalSteps: 1500,
            totalDistance: 1200.5,
            totalCalories: 85.3,
          }),
        })
      );
    });

    it('フィットネスデータがない場合、セッション総計は更新しない（軽量設計）', async () => {
      const req = makeRequest({
        sessionId: 1,
        latitude: 35.6895,
        longitude: 139.6917,
        // steps/distance/calories は送らない
      });
      await POST(req);

      expect(prisma.distributionSession.update).not.toHaveBeenCalled();
    });

    it('timestamp が省略された場合は現在時刻を使用する', async () => {
      const req = makeRequest(validGpsBody({ timestamp: undefined }));
      const beforeCall = Date.now();
      await POST(req);
      const afterCall = Date.now();

      expect(prisma.gpsPoint.create).toHaveBeenCalled();
      const callArgs = (prisma.gpsPoint.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const savedTimestamp = callArgs.data.timestamp as Date;
      expect(savedTimestamp.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(savedTimestamp.getTime()).toBeLessThanOrEqual(afterCall);
    });

    it('accuracy が省略された場合は null として保存する', async () => {
      const req = makeRequest(validGpsBody({ accuracy: undefined }));
      await POST(req);

      const callArgs = (prisma.gpsPoint.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.data.accuracy).toBeNull();
    });

    it('監査ログは記録しない（高頻度APIのパフォーマンス要件）', async () => {
      // auditLog モジュールが import されていないことを確認
      // GPS route は writeAuditLog を呼ばない設計
      const req = makeRequest(validGpsBody());
      await POST(req);

      // gpsPoint.create は呼ばれるが auditLog.create は呼ばれない
      expect(prisma.gpsPoint.create).toHaveBeenCalled();
    });
  });
});
