/**
 * PMS → Posting System スタッフ同期ユーティリティ
 *
 * PMS で配布員を登録/更新した際に、Posting System の m_staff テーブルに
 * 同期する。環境変数が未設定の場合はスキップ（エラーにならない）。
 *
 * 環境変数:
 * - POSTING_SYSTEM_API_URL: e.g. "https://postingsystem.net/postingmanage"
 * - POSTING_SYSTEM_API_KEY: 共有シークレット
 */

const API_URL = process.env.POSTING_SYSTEM_API_URL;
const API_KEY = process.env.POSTING_SYSTEM_API_KEY;

/**
 * PMS支店名 → Posting System 店舗名（SHOP_CD）マッピング
 * Posting System の m_shop テーブルの SHOP_CD はそのまま表示名
 * PMS側と異なる名前のみ定義（一致するものはそのまま渡す）
 */
const BRANCH_TO_SHOP_CD: Record<string, string> = {
  '高田馬場': '馬場',
};

/**
 * Posting System 業務区分コード（STAFF_DUTY_DIV）
 * 0 = 未設定, 1 = ポスティングスタッフ, 2 = 配送スタッフ, 3 = 折スタッフ, 4 = 本社スタッフ, 5 = 部長
 */
const STAFF_DUTY_DIV_POSTING = 1; // ポスティングスタッフ

export function isPostingSystemSyncConfigured(): boolean {
  return !!(API_URL && API_KEY);
}

/** PMS支店名からPosting System店舗コードを取得 */
export function branchNameToShopCd(branchName: string): string {
  return BRANCH_TO_SHOP_CD[branchName] || branchName;
}

interface SyncStaffParams {
  staffCd: string;
  staffName: string;
  staffTel: string;
  shopCd: string;
  joinDate?: string; // YYYY-MM-DD
  staffDutyDiv?: number;
}

/**
 * Posting System の m_staff に配布員を同期（INSERT or UPDATE STAFF_TEL）
 * fire-and-forget で呼ぶこと（await しても良いがエラーを投げない）
 */
export async function syncStaffToPostingSystem(
  params: SyncStaffParams
): Promise<{ success: boolean; error?: string }> {
  if (!isPostingSystemSyncConfigured()) {
    return { success: false, error: 'Posting System sync not configured' };
  }

  // STAFF_CD は char(7) — 超える場合はスキップ
  if (params.staffCd.length > 7) {
    console.warn(`[PostingSync] staffCd "${params.staffCd}" exceeds 7 chars, skipping`);
    return { success: false, error: 'staffCd exceeds 7 characters' };
  }

  try {
    const url = `${API_URL}/RegisterStaffFromPMS.php`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY!,
      },
      body: JSON.stringify({
        staffCd: params.staffCd,
        staffName: params.staffName,
        staffTel: params.staffTel,
        shopCd: params.shopCd,
        joinDate: params.joinDate || new Date().toISOString().slice(0, 10),
        staffDutyDiv: params.staffDutyDiv ?? STAFF_DUTY_DIV_POSTING,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      console.error('[PostingSync] Sync failed:', data.error);
      return { success: false, error: data.error || 'Unknown error' };
    }

    console.log(`[PostingSync] Synced staff ${params.staffCd} successfully (${data.action})`);
    return { success: true };
  } catch (err) {
    console.error('[PostingSync] Network error:', err);
    return { success: false, error: String(err) };
  }
}

interface SyncStaffRatesParams {
  staffCd: string;
  rate1: number | null;
  rate2: number | null;
  rate3: number | null;
  rate4: number | null;
  rate5: number | null;
  rate6: number | null;
}

/**
 * Posting System の m_staff_salary_detail に配布員の単価を同期
 * PMS で単価が更新された時に呼ぶ
 */
export async function syncStaffRatesToPostingSystem(
  params: SyncStaffRatesParams
): Promise<{ success: boolean; error?: string }> {
  if (!isPostingSystemSyncConfigured()) {
    return { success: false, error: 'Posting System sync not configured' };
  }

  if (params.staffCd.length > 7) {
    console.warn(`[PostingSync] staffCd "${params.staffCd}" exceeds 7 chars, skipping rate sync`);
    return { success: false, error: 'staffCd exceeds 7 characters' };
  }

  try {
    const url = `${API_URL}/UpdateStaffRates.php`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY!,
      },
      body: JSON.stringify({
        staffCd: params.staffCd,
        rates: {
          rate1: params.rate1 ?? 0,
          rate2: params.rate2 ?? 0,
          rate3: params.rate3 ?? 0,
          rate4: params.rate4 ?? 0,
          rate5: params.rate5 ?? 0,
          rate6: params.rate6 ?? 0,
        },
      }),
    });

    const data = await res.json();
    if (!data.success) {
      console.error('[PostingSync] Rate sync failed:', data.error);
      return { success: false, error: data.error || 'Unknown error' };
    }

    console.log(`[PostingSync] Synced rates for ${params.staffCd} (updated: ${data.updated}, inserted: ${data.inserted})`);
    return { success: true };
  } catch (err) {
    console.error('[PostingSync] Rate sync network error:', err);
    return { success: false, error: String(err) };
  }
}
