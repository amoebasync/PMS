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
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean; fallbackToPublicLink?: boolean }> {
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

    // 409 Conflict: テスターが既に存在する
    if (response.status === 409) {
      console.log(`[AppStoreConnect] Tester ${email} already exists (409), attempting remove and re-add...`);

      // 旧方式（実績あり）: グループから削除 → 再追加
      const removeResult = await removeBetaTester(email);
      console.log(`[AppStoreConnect] Remove result: success=${removeResult.success}, notFound=${removeResult.notFound}`);

      if (removeResult.success && !removeResult.notFound) {
        // グループから削除成功 → 1秒待って再追加
        await new Promise(r => setTimeout(r, 1000));
        const retryResponse = await fetch(`${API_BASE}/betaTesters`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${generateJWT()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (retryResponse.ok) {
          console.log(`[AppStoreConnect] Successfully re-invited beta tester: ${email}`);
          return { success: true, alreadyExists: true };
        }
        const retryErr = await retryResponse.json().catch(() => null);
        console.log(`[AppStoreConnect] Re-invite after remove failed: HTTP ${retryResponse.status}`, JSON.stringify(retryErr));
      }

      // グループから削除できない/再追加失敗 → パブリックリンクをメールで送信
      console.log(`[AppStoreConnect] API re-invite failed, falling back to public link email for ${email}`);
      return {
        success: true,
        alreadyExists: true,
        fallbackToPublicLink: true,
      };
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

/**
 * TestFlight ベータテスターを完全削除する（グループ関連解除ではなくテスター自体を削除）
 * これにより再追加時に招待メールが確実に再送される
 */
async function deleteBetaTesterCompletely(
  email: string,
): Promise<{ success: boolean; error?: string; notFound?: boolean }> {
  try {
    // まずグローバルにテスターを検索（グループフィルタなし）
    const token = generateJWT();
    const searchRes = await fetch(
      `${API_BASE}/betaTesters?filter[email]=${encodeURIComponent(email)}&fields[betaTesters]=email`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) {
      return { success: false, error: `テスター検索に失敗: HTTP ${searchRes.status}` };
    }
    const searchData = await searchRes.json();
    const testerId = searchData.data?.[0]?.id;
    if (!testerId) {
      console.log(`[AppStoreConnect] Tester ${email} not found globally`);
      return { success: true, notFound: true };
    }

    // テスター自体を DELETE（グループからの解除ではなく完全削除）
    const deleteRes = await fetch(`${API_BASE}/betaTesters/${testerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${generateJWT()}` },
    });

    if (deleteRes.status === 204 || deleteRes.status === 200) {
      console.log(`[AppStoreConnect] Completely deleted beta tester: ${email} (id: ${testerId})`);
      return { success: true };
    }
    if (deleteRes.status === 404) {
      return { success: true, notFound: true };
    }

    const errData = await deleteRes.json().catch(() => null);
    const errMsg = errData?.errors?.[0]?.detail || `HTTP ${deleteRes.status}`;
    console.error(`[AppStoreConnect] Failed to delete tester completely: ${errMsg}`);
    return { success: false, error: errMsg };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '不明なエラー';
    return { success: false, error: errMsg };
  }
}

/**
 * メールアドレスから TestFlight ベータテスターの ID を取得する
 */
async function findBetaTesterIdByEmail(email: string, filterByGroup: boolean = true): Promise<string | null> {
  try {
    const token = generateJWT();
    const filterParams = filterByGroup
      ? `filter[email]=${encodeURIComponent(email)}&filter[betaGroups]=${BETA_GROUP_ID}&fields[betaTesters]=email`
      : `filter[email]=${encodeURIComponent(email)}&fields[betaTesters]=email`;
    const response = await fetch(
      `${API_BASE}/betaTesters?${filterParams}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      console.log(`[AppStoreConnect] findBetaTester search failed: HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    console.log(`[AppStoreConnect] findBetaTester results: ${data.data?.length || 0} found (filterByGroup=${filterByGroup})`);
    return data.data?.[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * TestFlight ベータテスターをグループから削除する
 *
 * @param email - テスターのメールアドレス
 * @returns { success: boolean, error?: string, notFound?: boolean }
 */
export async function removeBetaTester(
  email: string,
): Promise<{ success: boolean; error?: string; notFound?: boolean }> {
  if (!isAppStoreConnectConfigured()) {
    return { success: false, error: 'App Store Connect APIが設定されていません' };
  }

  try {
    const testerId = await findBetaTesterIdByEmail(email);
    if (!testerId) {
      console.log(`[AppStoreConnect] Tester ${email} not found in beta group`);
      return { success: true, notFound: true };
    }

    const token = generateJWT();
    const response = await fetch(
      `${API_BASE}/betaGroups/${BETA_GROUP_ID}/relationships/betaTesters`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [{ type: 'betaTesters', id: testerId }],
        }),
      }
    );

    if (response.status === 404) {
      console.log(`[AppStoreConnect] Tester ${email} already removed from beta group`);
      return { success: true, notFound: true };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg = errorData?.errors?.[0]?.detail || `HTTP ${response.status}`;
      console.error('[AppStoreConnect] Failed to remove beta tester:', errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log(`[AppStoreConnect] Successfully removed beta tester: ${email}`);
    return { success: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '不明なエラー';
    console.error('[AppStoreConnect] Remove error:', errMsg);
    return { success: false, error: errMsg };
  }
}
