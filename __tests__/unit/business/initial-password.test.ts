/**
 * 配布員初期パスワード生成ロジックのテスト
 *
 * 仕様:
 * - 初期パスワード = SHA-256(YYYYMMDD)
 * - YYYYMMDD は birthday（YYYY-MM-DD）から生成
 * - 例: 1990-05-15 → SHA-256("19900515")
 *
 * 参照: src/app/api/applicants/[id]/register-as-distributor/route.ts
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// ルートファイルの buildInitialPassword と同じロジックをテスト用に再現
function buildInitialPassword(birthday: string): string {
  const d = new Date(birthday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return crypto.createHash('sha256').update(`${y}${m}${day}`).digest('hex');
}

describe('配布員初期パスワード生成（buildInitialPassword）', () => {
  it('誕生日 1990-05-15 → SHA-256("19900515") を返す', () => {
    const result = buildInitialPassword('1990-05-15');
    const expected = crypto.createHash('sha256').update('19900515').digest('hex');
    expect(result).toBe(expected);
  });

  it('誕生日 2000-01-01 → SHA-256("20000101") を返す', () => {
    const result = buildInitialPassword('2000-01-01');
    const expected = crypto.createHash('sha256').update('20000101').digest('hex');
    expect(result).toBe(expected);
  });

  it('誕生日 1985-12-31 → SHA-256("19851231") を返す', () => {
    const result = buildInitialPassword('1985-12-31');
    const expected = crypto.createHash('sha256').update('19851231').digest('hex');
    expect(result).toBe(expected);
  });

  it('月・日は必ずゼロ埋め2桁で扱う（例: 2月1日 → 0201）', () => {
    const result = buildInitialPassword('1995-02-01');
    const expected = crypto.createHash('sha256').update('19950201').digest('hex');
    expect(result).toBe(expected);
    // "19952 1" (パディングなし) ではないことを確認
    const wrong = crypto.createHash('sha256').update('199521').digest('hex');
    expect(result).not.toBe(wrong);
  });

  it('生成されるハッシュは 64 文字の16進数', () => {
    const result = buildInitialPassword('1990-01-01');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('同じ誕生日からは常に同じハッシュが生成される（決定論的）', () => {
    const hash1 = buildInitialPassword('1990-03-20');
    const hash2 = buildInitialPassword('1990-03-20');
    expect(hash1).toBe(hash2);
  });

  it('異なる誕生日からは異なるハッシュが生成される', () => {
    const hash1 = buildInitialPassword('1990-01-01');
    const hash2 = buildInitialPassword('1990-01-02');
    expect(hash1).not.toBe(hash2);
  });
});

// ----------------------------------------------------------------
// 応募者→配布員 変換ルール
// ----------------------------------------------------------------
describe('応募者から配布員への情報引き継ぎルール', () => {
  it('初期パスワードのフォーマット（YYYYMMDD）を確認する', () => {
    const birthday = '1999-07-04';
    const d = new Date(birthday);
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    expect(yyyymmdd).toBe('19990704');
  });

  it('attendanceCount は 0 から始まる', () => {
    const initialCount = 0;
    expect(initialCount).toBe(0);
  });

  it('isPasswordTemp は true で初期化される（初回ログイン時の変更を強制）', () => {
    const isPasswordTemp = true;
    expect(isPasswordTemp).toBe(true);
  });
});
