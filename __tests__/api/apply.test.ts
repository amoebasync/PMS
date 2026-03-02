/**
 * POST /api/apply のAPIテスト
 *
 * テスト対象: src/app/api/apply/route.ts
 *
 * テストケース:
 * - 必須パラメータ不足 → 400
 * - メール重複 → 409
 * - スロット予約済み → 409
 * - スロット期限切れ → 400
 * - 正常応募 → 201（メール送信・監査ログ記録）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ----------------------------------------------------------------
// モック定義（vi.mock はホイスト → インポートより前に評価される）
// ----------------------------------------------------------------

// Prisma トランザクション内で使う tx オブジェクト
const mockTx = {
  interviewSlot: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  applicant: {
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
    jobCategory: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@/lib/mailer', () => ({
  sendApplicantConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/google-meet', () => ({
  isGoogleMeetConfigured: vi.fn().mockReturnValue(false),
  createGoogleMeetEvent: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  getIpAddress: vi.fn().mockReturnValue('127.0.0.1'),
}));

// ----------------------------------------------------------------
// テスト本体
// ----------------------------------------------------------------
import { POST } from '@/app/api/apply/route';
import { prisma } from '@/lib/prisma';
import { sendApplicantConfirmationEmail } from '@/lib/mailer';

/** テスト用の最小限有効リクエストボディ */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'テスト 太郎',
    email: 'test@example.com',
    phone: '090-1234-5678',
    language: 'ja',
    jobCategoryId: 1,
    interviewSlotId: 10,
    ...overrides,
  };
}

/** JSON ボディを持つ Request オブジェクトを生成する */
function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 未来の面接スロット（有効なスロット） */
function futureSlot(overrides: Partial<{ isBooked: boolean; meetUrl: string | null }> = {}) {
  return {
    id: 10,
    startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1週間後
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    isBooked: false,
    meetUrl: null,
    applicantId: null,
    ...overrides,
  };
}

describe('POST /api/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルト: 職種は存在する
    (prisma.jobCategory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nameJa: 'ポスティング',
      nameEn: 'Posting',
    });

    // デフォルト: メール重複なし
    (prisma.applicant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // デフォルト: トランザクション内スロットは空きあり
    mockTx.interviewSlot.findUnique.mockResolvedValue(futureSlot());

    // デフォルト: 応募者作成成功
    mockTx.applicant.create.mockResolvedValue({
      id: 100,
      name: 'テスト 太郎',
      email: 'test@example.com',
      managementToken: 'mock_token_hex',
      language: 'ja',
    });

    // デフォルト: スロット更新成功
    mockTx.interviewSlot.update.mockResolvedValue({
      ...futureSlot(),
      isBooked: true,
      applicantId: 100,
      meetUrl: null,
    });
  });

  // ----------------------------------------------------------------
  // バリデーションエラー
  // ----------------------------------------------------------------
  describe('必須パラメータ不足', () => {
    it('name が欠落している場合 400 を返す', async () => {
      const req = makeRequest({ ...validBody(), name: '' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeTruthy();
    });

    it('email が欠落している場合 400 を返す', async () => {
      const req = makeRequest({ ...validBody(), email: undefined });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('jobCategoryId が欠落している場合 400 を返す', async () => {
      const req = makeRequest({ ...validBody(), jobCategoryId: undefined });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('interviewSlotId が欠落している場合 400 を返す', async () => {
      const req = makeRequest({ ...validBody(), interviewSlotId: undefined });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------
  // メール重複
  // ----------------------------------------------------------------
  describe('メール重複チェック', () => {
    it('既存のメールアドレスで応募した場合 409 を返す', async () => {
      (prisma.applicant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 99,
        email: 'test@example.com',
      });

      const req = makeRequest(validBody());
      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('既に登録されています');
    });
  });

  // ----------------------------------------------------------------
  // スロット不正
  // ----------------------------------------------------------------
  describe('スロットの状態チェック', () => {
    it('予約済みスロットを指定した場合 409 を返す', async () => {
      mockTx.interviewSlot.findUnique.mockResolvedValue(futureSlot({ isBooked: true }));

      const req = makeRequest(validBody());
      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('既に予約されています');
    });

    it('期限切れのスロットを指定した場合 400 を返す', async () => {
      mockTx.interviewSlot.findUnique.mockResolvedValue({
        id: 10,
        startTime: new Date('2020-01-01T09:00:00Z'), // 過去
        endTime: new Date('2020-01-01T10:00:00Z'),
        isBooked: false,
        meetUrl: null,
      });

      const req = makeRequest(validBody());
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('過ぎています');
    });

    it('スロットが存在しない場合 409 を返す', async () => {
      mockTx.interviewSlot.findUnique.mockResolvedValue(null);

      const req = makeRequest(validBody());
      const res = await POST(req);
      expect(res.status).toBe(409);
    });
  });

  // ----------------------------------------------------------------
  // 正常応募
  // ----------------------------------------------------------------
  describe('正常系', () => {
    it('有効なデータで応募すると 200 を返し、応募者情報と面接情報を含む', async () => {
      const req = makeRequest(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.applicant).toBeDefined();
      expect(json.applicant.id).toBe(100);
      expect(json.applicant.name).toBe('テスト 太郎');
      expect(json.applicant.email).toBe('test@example.com');
      expect(json.interview).toBeDefined();
      expect(json.interview.date).toBeTruthy();
      expect(json.interview.time).toBeTruthy();
    });

    it('応募成功時にスロットが予約済みに更新される', async () => {
      const req = makeRequest(validBody());
      await POST(req);

      expect(mockTx.interviewSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({ isBooked: true, applicantId: 100 }),
        })
      );
    });

    it('応募成功時にメール送信が非同期で呼ばれる', async () => {
      const req = makeRequest(validBody());
      await POST(req);

      // メール送信は非同期で呼ばれるため、短いウェイトを入れる
      await new Promise((r) => setTimeout(r, 50));
      expect(sendApplicantConfirmationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'テスト 太郎',
        'ja',
        expect.any(String), // date
        expect.any(String), // time
        null,               // meetUrl
        expect.any(String), // jobName
        'mock_token_hex',
      );
    });

    it('英語言語で応募した場合、メールの第3引数（language）が en になる', async () => {
      const req = makeRequest(validBody({ language: 'en' }));
      await POST(req);

      await new Promise((r) => setTimeout(r, 50));
      // language 引数（第3引数）が 'en' であることを確認
      const calls = (sendApplicantConfirmationEmail as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toBe('en');
    });

    it('オプションパラメータ（phone, countryId 等）がなくても応募できる', async () => {
      const minimalBody = {
        name: '最小限 太郎',
        email: 'minimal@example.com',
        jobCategoryId: 1,
        interviewSlotId: 10,
      };

      mockTx.applicant.create.mockResolvedValue({
        id: 101,
        name: '最小限 太郎',
        email: 'minimal@example.com',
        managementToken: 'token_minimal',
        language: 'ja',
      });
      mockTx.interviewSlot.update.mockResolvedValue({
        ...futureSlot(),
        isBooked: true,
        applicantId: 101,
        meetUrl: null,
      });

      const req = makeRequest(minimalBody);
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });
});
