/**
 * Google Workspace Admin SDK (Directory API) を使用して
 * Google グループにメンバーを追加し、Play Console 内部テストのテスターを管理する
 *
 * 必要な環境変数:
 * - GOOGLE_CLIENT_ID: OAuth クライアントID（既存の Google Meet 用と共用）
 * - GOOGLE_CLIENT_SECRET: OAuth クライアントシークレット（同上）
 * - GOOGLE_ADMIN_REFRESH_TOKEN: Admin SDK 用リフレッシュトークン（admin.directory.group.member スコープ）
 * - GOOGLE_PLAY_TESTER_GROUP_EMAIL: 内部テスト用 Google グループのメールアドレス
 */

import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ADMIN_REFRESH_TOKEN = process.env.GOOGLE_ADMIN_REFRESH_TOKEN;
const GROUP_EMAIL = process.env.GOOGLE_PLAY_TESTER_GROUP_EMAIL;

/**
 * Google Play テスター管理が設定されているかチェック
 */
export function isGooglePlayTesterConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && ADMIN_REFRESH_TOKEN && GROUP_EMAIL);
}

/**
 * Admin SDK 用の OAuth2 クライアントを生成
 */
function getAdminClient() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  );
  oauth2Client.setCredentials({
    refresh_token: ADMIN_REFRESH_TOKEN,
  });
  return google.admin({ version: 'directory_v1', auth: oauth2Client });
}

/**
 * Google グループにメンバーを追加する（Play Console 内部テスト用）
 *
 * @param email - 追加するメンバーのメールアドレス
 * @returns { success, error?, alreadyExists?, memberStatus? }
 */
export async function addToGoogleGroup(
  email: string,
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean; memberStatus?: string }> {
  if (!isGooglePlayTesterConfigured()) {
    return { success: false, error: 'Google Play テスター管理APIが設定されていません' };
  }

  try {
    const admin = getAdminClient();

    const insertRes = await admin.members.insert({
      groupKey: GROUP_EMAIL!,
      requestBody: {
        email,
        role: 'MEMBER',
      },
    });

    const memberStatus = insertRes.data.status || 'ACTIVE';
    console.log(`[GooglePlayTester] Added ${email} to group ${GROUP_EMAIL} (status: ${memberStatus}, role: ${insertRes.data.role})`);

    // 招待状態（INVITED）の場合は警告ログ
    if (memberStatus === 'INVITED') {
      console.warn(`[GooglePlayTester] ${email} is in INVITED state - they need to accept the invitation to join the group`);
    }

    return { success: true, memberStatus };
  } catch (error: any) {
    const status = error.code || error.response?.status;
    const message = error.errors?.[0]?.message || error.message || '不明なエラー';

    // 409: メンバーが既に存在する → 現在のステータスを確認
    if (status === 409) {
      console.log(`[GooglePlayTester] ${email} is already a member of ${GROUP_EMAIL}`);
      const currentStatus = await getGroupMemberStatus(email);
      return { success: true, alreadyExists: true, memberStatus: currentStatus || undefined };
    }

    // 認証エラー
    if (status === 401 || status === 403) {
      console.error(`[GooglePlayTester] Authentication error (${status}):`, message);
      return { success: false, error: `認証に失敗しました (${status}): ${message}` };
    }

    console.error(`[GooglePlayTester] Error adding member (${status}):`, message);
    return { success: false, error: `${message} (${status || 'unknown'})` };
  }
}

/**
 * グループメンバーの現在のステータスを取得
 */
async function getGroupMemberStatus(email: string): Promise<string | null> {
  try {
    const admin = getAdminClient();
    const res = await admin.members.get({
      groupKey: GROUP_EMAIL!,
      memberKey: email,
    });
    return res.data.status || null;
  } catch {
    return null;
  }
}

/**
 * Google グループからメンバーを削除する
 *
 * @param email - 削除するメンバーのメールアドレス
 * @returns { success, error?, notFound? }
 */
export async function removeFromGoogleGroup(
  email: string,
): Promise<{ success: boolean; error?: string; notFound?: boolean }> {
  if (!isGooglePlayTesterConfigured()) {
    return { success: false, error: 'Google Play テスター管理APIが設定されていません' };
  }

  try {
    const admin = getAdminClient();

    await admin.members.delete({
      groupKey: GROUP_EMAIL!,
      memberKey: email,
    });

    console.log(`[GooglePlayTester] Removed ${email} from group ${GROUP_EMAIL}`);
    return { success: true };
  } catch (error: any) {
    const status = error.code || error.response?.status;
    const message = error.errors?.[0]?.message || error.message || '不明なエラー';

    // 404: メンバーが存在しない（既に削除済み等）
    if (status === 404) {
      console.log(`[GooglePlayTester] ${email} is not a member of ${GROUP_EMAIL} (already removed)`);
      return { success: true, notFound: true };
    }

    console.error(`[GooglePlayTester] Error removing member (${status}):`, message);
    return { success: false, error: `${message} (${status || 'unknown'})` };
  }
}

/**
 * グループの全メンバーを取得（デバッグ・管理用）
 */
export async function listGoogleGroupMembers(): Promise<{ success: boolean; members?: any[]; error?: string }> {
  if (!isGooglePlayTesterConfigured()) {
    return { success: false, error: 'Google Play テスター管理APIが設定されていません' };
  }

  try {
    const admin = getAdminClient();
    const res = await admin.members.list({
      groupKey: GROUP_EMAIL!,
      maxResults: 200,
    });
    return {
      success: true,
      members: (res.data.members || []).map(m => ({
        email: m.email,
        role: m.role,
        status: m.status,
        type: m.type,
      })),
    };
  } catch (error: any) {
    const message = error.errors?.[0]?.message || error.message || '不明なエラー';
    console.error('[GooglePlayTester] Error listing members:', message);
    return { success: false, error: message };
  }
}
