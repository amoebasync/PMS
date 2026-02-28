/**
 * App Store Connect API を使用して TestFlight ベータテスターを招待する
 *
 * 必要な環境変数:
 * - APPSTORE_CONNECT_ISSUER_ID: App Store Connect の Issuer ID
 * - APPSTORE_CONNECT_KEY_ID: API キーの Key ID
 * - APPSTORE_CONNECT_PRIVATE_KEY: .p8 秘密鍵の内容（\n をリテラルで含む）
 * - APPSTORE_CONNECT_BETA_GROUP_ID: TestFlight ベータグループの ID
 */

import jwt from 'jsonwebtoken';

const ISSUER_ID = process.env.APPSTORE_CONNECT_ISSUER_ID;
const KEY_ID = process.env.APPSTORE_CONNECT_KEY_ID;
const PRIVATE_KEY = process.env.APPSTORE_CONNECT_PRIVATE_KEY?.replace(/\\n/g, '\n');
const BETA_GROUP_ID = process.env.APPSTORE_CONNECT_BETA_GROUP_ID;

const API_BASE = 'https://api.appstoreconnect.apple.com/v1';

/**
 * App Store Connect API が設定されているかチェック
 */
export function isAppStoreConnectConfigured(): boolean {
  return !!(ISSUER_ID && KEY_ID && PRIVATE_KEY && BETA_GROUP_ID);
}

/**
 * App Store Connect API 用の JWT トークンを生成（ES256、有効期限 20 分）
 */
function generateJWT(): string {
  if (!ISSUER_ID || !KEY_ID || !PRIVATE_KEY) {
    throw new Error('App Store Connect API の環境変数が設定されていません');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 20 * 60, // 20分
    aud: 'appstoreconnect-v1',
  };

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: KEY_ID,
      typ: 'JWT',
    },
  });
}

/**
 * TestFlight ベータテスターを追加する
 *
 * @param email - テスターのメールアドレス
 * @param firstName - テスターの名前（オプション）
 * @param lastName - テスターの姓（オプション）
 * @returns { success: boolean, error?: string, alreadyExists?: boolean }
 */
export async function addBetaTester(
  email: string,
  firstName?: string,
  lastName?: string,
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  if (!isAppStoreConnectConfigured()) {
    return { success: false, error: 'App Store Connect APIが設定されていません' };
  }

  try {
    const token = generateJWT();

    const body = {
      data: {
        type: 'betaTesters',
        attributes: {
          email,
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
        },
        relationships: {
          betaGroups: {
            data: [{ type: 'betaGroups', id: BETA_GROUP_ID }],
          },
        },
      },
    };

    const response = await fetch(`${API_BASE}/betaTesters`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // 409 Conflict: テスターが既にグループに存在する
    if (response.status === 409) {
      console.log(`[AppStoreConnect] Tester ${email} already exists in beta group`);
      return { success: true, alreadyExists: true };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg =
        errorData?.errors?.[0]?.detail ||
        errorData?.errors?.[0]?.title ||
        `HTTP ${response.status}`;
      console.error('[AppStoreConnect] Failed to add beta tester:', errorMsg);

      // 認証エラー
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: '認証に失敗しました。APIキーを確認してください' };
      }

      return { success: false, error: errorMsg };
    }

    console.log(`[AppStoreConnect] Successfully added beta tester: ${email}`);
    return { success: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '不明なエラー';
    console.error('[AppStoreConnect] Error:', errMsg);
    return { success: false, error: errMsg };
  }
}
