/**
 * lib/password.ts のユニットテスト
 *
 * テスト対象:
 * - hashPassword(): bcrypt ハッシュ生成
 * - verifyPassword(): bcrypt / SHA-256 ハッシュ検証
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from '@/lib/password';

// ----------------------------------------------------------------
// hashPassword
// ----------------------------------------------------------------
describe('hashPassword()', () => {
  it('bcrypt ハッシュを生成する（$2b$ または $2a$ で始まる）', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('同じパスワードでも毎回異なるハッシュを生成する（ソルトが異なるため）', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toBe(hash2);
  });

  it('生成したハッシュは verifyPassword で検証できる', async () => {
    const hash = await hashPassword('testpassword!');
    const result = await verifyPassword('testpassword!', hash);
    expect(result.verified).toBe(true);
  });
});

// ----------------------------------------------------------------
// verifyPassword — bcrypt ハッシュ
// ----------------------------------------------------------------
describe('verifyPassword() — bcrypt ハッシュ', () => {
  it('正しいパスワードで verified=true、needsUpgrade=false を返す', async () => {
    const hash = await hashPassword('correct_password');
    const result = await verifyPassword('correct_password', hash);
    expect(result.verified).toBe(true);
    expect(result.needsUpgrade).toBe(false);
  });

  it('誤ったパスワードで verified=false、needsUpgrade=false を返す', async () => {
    const hash = await hashPassword('correct_password');
    const result = await verifyPassword('wrong_password', hash);
    expect(result.verified).toBe(false);
    expect(result.needsUpgrade).toBe(false);
  });

  it('空文字パスワードでも動作する', async () => {
    const hash = await hashPassword('');
    const result = await verifyPassword('', hash);
    expect(result.verified).toBe(true);
    expect(result.needsUpgrade).toBe(false);
  });
});

// ----------------------------------------------------------------
// verifyPassword — SHA-256 レガシーハッシュ（配布員初期パスワード含む）
// ----------------------------------------------------------------
describe('verifyPassword() — SHA-256 レガシーハッシュ', () => {
  function sha256(plain: string): string {
    return crypto.createHash('sha256').update(plain).digest('hex');
  }

  it('一致する場合: verified=true、needsUpgrade=true（bcrypt へのアップグレードが必要）', async () => {
    const hash = sha256('password123');
    const result = await verifyPassword('password123', hash);
    expect(result.verified).toBe(true);
    expect(result.needsUpgrade).toBe(true);
  });

  it('不一致の場合: verified=false、needsUpgrade=false', async () => {
    const hash = sha256('password123');
    const result = await verifyPassword('wrongpassword', hash);
    expect(result.verified).toBe(false);
    expect(result.needsUpgrade).toBe(false);
  });

  it('配布員初期パスワード（誕生日YYYYMMDD の SHA-256）を検証できる', async () => {
    // 誕生日 1990-05-15 → YYYYMMDD = "19900515"
    const birthday = '1990-05-15';
    const d = new Date(birthday);
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    const initialPasswordHash = sha256(yyyymmdd);

    const result = await verifyPassword(yyyymmdd, initialPasswordHash);
    expect(result.verified).toBe(true);
    expect(result.needsUpgrade).toBe(true);
    expect(yyyymmdd).toBe('19900515');
  });

  it('誕生日 2000-01-01 の初期パスワードを検証できる', async () => {
    const yyyymmdd = '20000101';
    const hash = sha256(yyyymmdd);
    const result = await verifyPassword(yyyymmdd, hash);
    expect(result.verified).toBe(true);
  });

  it('SHA-256 ハッシュは 64 文字の16進数', () => {
    const hash = sha256('any_input');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
