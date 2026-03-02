/**
 * lib/audit.ts のユニットテスト
 *
 * テスト対象:
 * - sanitizeSnapshot(): センシティブフィールドの除外
 * - getIpAddress(): クライアントIPの取得
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSnapshot, getIpAddress } from '@/lib/audit';

// ----------------------------------------------------------------
// sanitizeSnapshot
// ----------------------------------------------------------------
describe('sanitizeSnapshot()', () => {
  it('nullを渡した場合はnullを返す', () => {
    expect(sanitizeSnapshot(null)).toBeNull();
  });

  it('undefinedを渡した場合はnullを返す', () => {
    expect(sanitizeSnapshot(undefined)).toBeNull();
  });

  it('グローバルセンシティブフィールド passwordHash を除外する', () => {
    const data = { id: 1, name: '山田太郎', passwordHash: 'secret_bcrypt_hash' };
    const result = sanitizeSnapshot(data);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.name).toBe('山田太郎');
    expect(result!.passwordHash).toBeUndefined();
  });

  it('グローバルセンシティブフィールド password_hash（スネークケース）を除外する', () => {
    const data = { id: 1, password_hash: 'legacy_hash' };
    const result = sanitizeSnapshot(data);
    expect(result!.password_hash).toBeUndefined();
  });

  it('グローバルセンシティブフィールド token を除外する', () => {
    const data = { id: 1, email: 'test@example.com', token: 'reset_token_xyz' };
    const result = sanitizeSnapshot(data);
    expect(result!.email).toBe('test@example.com');
    expect(result!.token).toBeUndefined();
  });

  it('グローバルセンシティブフィールド passwordResetToken を除外する', () => {
    const data = { id: 1, passwordResetToken: 'reset_token' };
    const result = sanitizeSnapshot(data);
    expect(result!.passwordResetToken).toBeUndefined();
  });

  it('Employee モデルのセンシティブフィールドを除外する', () => {
    const data = {
      id: 1,
      lastNameJa: '山田',
      firstNameJa: '太郎',
      email: 'yamada@example.com',
      passwordHash: 'secret',
      passwordResetToken: 'reset_token',
    };
    const result = sanitizeSnapshot(data, 'Employee');
    expect(result!.id).toBe(1);
    expect(result!.lastNameJa).toBe('山田');
    expect(result!.email).toBe('yamada@example.com');
    expect(result!.passwordHash).toBeUndefined();
    expect(result!.passwordResetToken).toBeUndefined();
  });

  it('EmployeeFinancial モデルの accountNumber を除外する', () => {
    const data = {
      id: 1,
      bankName: 'みずほ銀行',
      accountNumber: '1234567',
      branchName: '新宿支店',
    };
    const result = sanitizeSnapshot(data, 'EmployeeFinancial');
    expect(result!.id).toBe(1);
    expect(result!.bankName).toBe('みずほ銀行');
    expect(result!.branchName).toBe('新宿支店');
    expect(result!.accountNumber).toBeUndefined();
  });

  it('FlyerDistributor モデルの passwordHash を除外する', () => {
    const data = {
      id: 10,
      name: 'テスト配布員',
      passwordHash: 'distributor_hash',
      email: 'dist@example.com',
    };
    const result = sanitizeSnapshot(data, 'FlyerDistributor');
    expect(result!.name).toBe('テスト配布員');
    expect(result!.passwordHash).toBeUndefined();
  });

  it('センシティブでないフィールドはすべて保持する', () => {
    const data = {
      id: 42,
      email: 'test@example.com',
      phone: '090-1234-5678',
      createdAt: new Date('2026-01-01'),
      status: 'ACTIVE',
    };
    const result = sanitizeSnapshot(data);
    expect(result).toEqual(data);
  });

  it('ネストしたオブジェクトはそのまま保持する（深い除外はしない）', () => {
    const data = {
      id: 1,
      profile: { name: '山田', secret: 'nested_value' },
    };
    const result = sanitizeSnapshot(data);
    // ネストの中身は除外しない（シャローな処理）
    expect(result!.profile).toEqual({ name: '山田', secret: 'nested_value' });
  });

  it('複数のセンシティブフィールドをまとめて除外する', () => {
    const data = {
      id: 1,
      name: 'テスト',
      passwordHash: 'hash1',
      password_hash: 'hash2',
      token: 'token_value',
      passwordResetToken: 'reset_token',
      email: 'safe@example.com',
    };
    const result = sanitizeSnapshot(data);
    expect(Object.keys(result!)).toEqual(['id', 'name', 'email']);
  });
});

// ----------------------------------------------------------------
// getIpAddress
// ----------------------------------------------------------------
describe('getIpAddress()', () => {
  it('x-forwarded-for が複数IPの場合、最初のIPを返す（ALB → EC2構成）', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1' },
    });
    expect(getIpAddress(request)).toBe('203.0.113.1');
  });

  it('x-forwarded-for が単一IPの場合、トリムして返す', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  192.168.1.100  ' },
    });
    expect(getIpAddress(request)).toBe('192.168.1.100');
  });

  it('x-forwarded-for がない場合、x-real-ip をフォールバックとして使用する', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.5' },
    });
    expect(getIpAddress(request)).toBe('10.0.0.5');
  });

  it('どちらのヘッダーもない場合、nullを返す', () => {
    const request = new Request('http://localhost');
    expect(getIpAddress(request)).toBeNull();
  });

  it('x-forwarded-for があれば x-real-ip より優先される', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8',
      },
    });
    expect(getIpAddress(request)).toBe('1.2.3.4');
  });
});
