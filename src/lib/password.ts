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

/**
 * 誕生日パスワードの柔軟マッチ
 * ユーザーがゼロ省略で入力しても（例: 1993111 → 19931101）ログインできるようにする。
 * 入力値を誕生日のYYYYMMDDと照合し、ゼロ省略版でも一致すればtrueを返す。
 */
export function matchesBirthdayPassword(input: string, birthday: Date): boolean {
  const y = birthday.getFullYear();
  const m = birthday.getMonth() + 1;
  const d = birthday.getDate();
  const canonical = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;

  // 正規入力（YYYYMMDD）
  if (input === canonical) return true;

  // ゼロ省略パターン（YYYYMD, YYYYMMD, YYYYMDD）
  const variants = [
    `${y}${m}${d}`,
    `${y}${String(m).padStart(2, '0')}${d}`,
    `${y}${m}${String(d).padStart(2, '0')}`,
  ];
  return variants.includes(input);
}

/**
 * 誕生日からYYYYMMDD形式の正規文字列を返す
 */
export function birthdayToYYYYMMDD(birthday: Date): string {
  const y = birthday.getFullYear();
  const m = String(birthday.getMonth() + 1).padStart(2, '0');
  const d = String(birthday.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
