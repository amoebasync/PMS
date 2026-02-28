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
 * Google グループにメンバーを追加する（Play Console 内部テスト用）
 *
 * @param email - 追加するメンバーのメールアドレス
 * @returns { success, error?, alreadyExists? }
 */
export async function addToGoogleGroup(
  email: string,
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  if (!isGooglePlayTesterConfigured()) {
    return { success: false, error: 'Google Play テスター管理APIが設定されていません' };
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      'https://developers.google.com/oauthplayground',
    );

    oauth2Client.setCredentials({
      refresh_token: ADMIN_REFRESH_TOKEN,
    });

    const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });

    await admin.members.insert({
      groupKey: GROUP_EMAIL!,
      requestBody: {
        email,
        role: 'MEMBER',
      },
    });

    console.log(`[GooglePlayTester] Successfully added ${email} to group ${GROUP_EMAIL}`);
    return { success: true };
  } catch (error: any) {
    const status = error.code || error.response?.status;
    const message = error.errors?.[0]?.message || error.message || '不明なエラー';

    // 409: メンバーが既に存在する
    if (status === 409) {
      console.log(`[GooglePlayTester] ${email} is already a member of ${GROUP_EMAIL}`);
      return { success: true, alreadyExists: true };
    }

    // 認証エラー
    if (status === 401 || status === 403) {
      console.error('[GooglePlayTester] Authentication error:', message);
      return { success: false, error: '認証に失敗しました。GOOGLE_ADMIN_REFRESH_TOKENを確認してください' };
    }

    console.error('[GooglePlayTester] Error adding member:', message);
    return { success: false, error: message };
  }
}
