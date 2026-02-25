/**
 * パスワードハッシュユーティリティ
 *
 * 移行戦略:
 * - 新規パスワードはすべて bcrypt でハッシュ化
 * - 既存の SHA-256 ハッシュにも対応（ログイン時に自動的に bcrypt へアップグレード）
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;

/** bcryptハッシュかどうか判定（$2a$ または $2b$ で始まる） */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

/** SHA-256ハッシュを生成（レガシー互換用） */
function sha256Hash(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * パスワードをbcryptでハッシュ化する（新規登録・パスワード変更時に使用）
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * パスワードを検証する
 * - bcryptハッシュ → bcrypt.compare で検証
 * - SHA-256ハッシュ（レガシー）→ SHA-256で比較
 *
 * @returns verified: 検証結果, needsUpgrade: trueの場合、呼び出し元でbcryptにアップグレードすること
 */
export async function verifyPassword(
  plaintext: string,
  storedHash: string
): Promise<{ verified: boolean; needsUpgrade: boolean }> {
  if (isBcryptHash(storedHash)) {
    const verified = await bcrypt.compare(plaintext, storedHash);
    return { verified, needsUpgrade: false };
  }

  // レガシーSHA-256ハッシュの場合
  const sha256 = sha256Hash(plaintext);
  const verified = sha256 === storedHash;
  return { verified, needsUpgrade: verified }; // 一致した場合はアップグレードが必要
}
