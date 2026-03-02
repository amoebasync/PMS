/**
 * POST /api/applicants/[id]/register-as-distributor のAPIテスト
 *
 * テスト対象: src/app/api/applicants/[id]/register-as-distributor/route.ts
 *
 * テストケース:
 * - 未認証 → 401
 * - birthday 欠落 → 400
 * - branchId 欠落 → 400
 * - 応募者不在 → 404
 * - メールアドレス重複（Prisma P2002）→ 409
 * - 正常登録 → 200（SHA-256パスワード、情報継承）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ----------------------------------------------------------------
// モック定義
// ----------------------------------------------------------------
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const mockTx = {
  flyerDistributor: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    applicant: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  getAdminActorInfo: vi.fn().mockResolvedValue({ actorId: 1, actorName: '管理者 一郎' }),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}));

// ----------------------------------------------------------------
// テスト本体
// ----------------------------------------------------------------
import { POST } from '@/app/api/applicants/[id]/register-as-distributor/route';
import { prisma } from '@/lib/prisma';

/** SHA-256 ハッシュを計算するヘルパー（初期パスワード検証用） */
function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** テスト用リクエストを生成する */
function makeRequest(
  id: string,
  body: Record<string, unknown>
): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/applicants/${id}/register-as-distributor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const context = { params: Promise.resolve({ id }) };
  return [req, context];
}

/** テスト用の応募者データ */
const mockApplicant = {
  id: 50,
  name: 'テスト 花子',
  email: 'hanako@example.com',
  phone: '090-9876-5432',
  postalCode: '160-0022',
  address: '東京都新宿区',
  building: null,
  countryId: 1,
  visaTypeId: null,
};

describe('POST /api/applicants/[id]/register-as-distributor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルト: 管理者認証済み
    mockCookieStore.get.mockReturnValue({ value: '1' });

    // デフォルト: 応募者存在
    (prisma.applicant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockApplicant);

    // デフォルト: 配布員作成成功
    mockTx.flyerDistributor.create.mockResolvedValue({
      id: 200,
      name: 'テスト 花子',
      email: 'hanako@example.com',
      branchId: 2,
      isPasswordTemp: true,
    });
  });

  // ----------------------------------------------------------------
  // 認証チェック
  // ----------------------------------------------------------------
  describe('認証チェック', () => {
    it('pms_session cookie がない場合 401 を返す', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01', branchId: 2 });
      const res = await POST(req, ctx);
      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // バリデーション
  // ----------------------------------------------------------------
  describe('バリデーション', () => {
    it('birthday が欠落している場合 400 を返す', async () => {
      const [req, ctx] = makeRequest('50', { branchId: 2 });
      const res = await POST(req, ctx);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('生年月日');
    });

    it('branchId が欠落している場合 400 を返す', async () => {
      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01' });
      const res = await POST(req, ctx);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('支店');
    });
  });

  // ----------------------------------------------------------------
  // 応募者不在
  // ----------------------------------------------------------------
  describe('応募者の存在チェック', () => {
    it('応募者が存在しない場合 404 を返す', async () => {
      (prisma.applicant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const [req, ctx] = makeRequest('999', { birthday: '1990-01-01', branchId: 2 });
      const res = await POST(req, ctx);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('見つかりません');
    });
  });

  // ----------------------------------------------------------------
  // 重複エラー
  // ----------------------------------------------------------------
  describe('メールアドレス重複', () => {
    it('既存の配布員と同じメールアドレスの場合 409 を返す（Prisma P2002）', async () => {
      const p2002Error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      mockTx.flyerDistributor.create.mockRejectedValue(p2002Error);

      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01', branchId: 2 });
      const res = await POST(req, ctx);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('既に登録されています');
    });
  });

  // ----------------------------------------------------------------
  // 正常登録
  // ----------------------------------------------------------------
  describe('正常系', () => {
    it('有効なデータで 200 を返し、distributorId と name を含む', async () => {
      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01', branchId: 2 });
      const res = await POST(req, ctx);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.distributorId).toBe(200);
      expect(json.name).toBe('テスト 花子');
    });

    it('初期パスワードは birthday（YYYYMMDD）の SHA-256 ハッシュで生成される', async () => {
      const birthday = '1990-05-15';
      const expectedHash = sha256('19900515');

      const [req, ctx] = makeRequest('50', { birthday, branchId: 2 });
      await POST(req, ctx);

      expect(mockTx.flyerDistributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expectedHash,
          }),
        })
      );
    });

    it('isPasswordTemp が true で登録される（初回ログイン時にパスワード変更を促す）', async () => {
      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01', branchId: 2 });
      await POST(req, ctx);

      expect(mockTx.flyerDistributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPasswordTemp: true }),
        })
      );
    });

    it('応募者の情報（name, email, phone, address）が配布員に引き継がれる', async () => {
      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01', branchId: 2 });
      await POST(req, ctx);

      expect(mockTx.flyerDistributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'テスト 花子',
            email: 'hanako@example.com',
            phone: '090-9876-5432',
            postalCode: '160-0022',
            address: '東京都新宿区',
          }),
        })
      );
    });

    it('オプション staffId が渡された場合、配布員に設定される', async () => {
      const [req, ctx] = makeRequest('50', {
        birthday: '1990-01-01',
        branchId: 2,
        staffId: 'STF-001',
      });
      await POST(req, ctx);

      expect(mockTx.flyerDistributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ staffId: 'STF-001' }),
        })
      );
    });

    it('オプション gender が渡された場合、配布員に設定される', async () => {
      const [req, ctx] = makeRequest('50', {
        birthday: '1990-01-01',
        branchId: 2,
        gender: 'F',
      });
      await POST(req, ctx);

      expect(mockTx.flyerDistributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gender: 'F' }),
        })
      );
    });

    it('応募者の国籍・ビザ種別が引き継がれる', async () => {
      const [req, ctx] = makeRequest('50', { birthday: '1990-01-01', branchId: 2 });
      await POST(req, ctx);

      expect(mockTx.flyerDistributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countryId: 1,
            visaTypeId: null,
          }),
        })
      );
    });

    it('誕生日 2000-01-01 の SHA-256 パスワードが正しく生成される', async () => {
      const birthday = '2000-01-01';
      const expectedHash = sha256('20000101');

      const [req, ctx] = makeRequest('50', { birthday, branchId: 2 });
      await POST(req, ctx);

      const callArgs = mockTx.flyerDistributor.create.mock.calls[0][0];
      expect(callArgs.data.passwordHash).toBe(expectedHash);
    });
  });
});
