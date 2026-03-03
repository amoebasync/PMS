/**
 * Google Workspace Admin SDK (Directory API) を使用して
 * @tiramis.co.jp ドメインのユーザーアカウントを自動作成する
 *
 * 必要な環境変数:
 * - GOOGLE_CLIENT_ID: OAuth クライアントID
 * - GOOGLE_CLIENT_SECRET: OAuth クライアントシークレット
 * - GOOGLE_ADMIN_REFRESH_TOKEN: Admin SDK 用リフレッシュトークン（admin.directory.user スコープ必須）
 */

import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ADMIN_REFRESH_TOKEN = process.env.GOOGLE_ADMIN_REFRESH_TOKEN;
const DOMAIN = 'tiramis.co.jp';

/**
 * Google Workspace ユーザー作成が設定されているかチェック
 */
export function isGoogleWorkspaceConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && ADMIN_REFRESH_TOKEN);
}

function getAdminClient() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  );
  oauth2Client.setCredentials({ refresh_token: ADMIN_REFRESH_TOKEN });
  return google.admin({ version: 'directory_v1', auth: oauth2Client });
}

/**
 * メールアドレスが既に存在するかチェック
 */
async function emailExists(admin: ReturnType<typeof getAdminClient>, email: string): Promise<boolean> {
  try {
    await admin.users.get({ userKey: email });
    return true;
  } catch (error: any) {
    if (error.code === 404) return false;
    throw error;
  }
}

/**
 * 重複しないメールアドレスを生成する
 * firstname.lastname@tiramis.co.jp → firstname.lastname2@tiramis.co.jp → ...
 */
export async function generateUniqueEmail(
  firstNameEn: string,
  lastNameEn: string,
): Promise<string> {
  const admin = getAdminClient();
  const base = `${firstNameEn.toLowerCase()}.${lastNameEn.toLowerCase()}`;
  const candidate = `${base}@${DOMAIN}`;

  if (!(await emailExists(admin, candidate))) {
    return candidate;
  }

  for (let i = 2; i <= 99; i++) {
    const numbered = `${base}${i}@${DOMAIN}`;
    if (!(await emailExists(admin, numbered))) {
      return numbered;
    }
  }

  throw new Error(`メールアドレスの生成に失敗しました: ${base}@${DOMAIN} の重複が多すぎます`);
}

/**
 * Google Workspace ユーザーを作成する
 */
export async function createWorkspaceUser(
  email: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!isGoogleWorkspaceConfigured()) {
    return { success: false, error: 'Google Workspace APIが設定されていません' };
  }

  try {
    const admin = getAdminClient();

    await admin.users.insert({
      requestBody: {
        primaryEmail: email,
        name: {
          givenName: firstName,
          familyName: lastName,
        },
        password,
        changePasswordAtNextLogin: true,
      },
    });

    console.log(`[GoogleWorkspace] Successfully created user: ${email}`);
    return { success: true, email };
  } catch (error: any) {
    const status = error.code || error.response?.status;
    const message = error.errors?.[0]?.message || error.message || '不明なエラー';

    if (status === 409) {
      console.error(`[GoogleWorkspace] User already exists: ${email}`);
      return { success: false, error: `ユーザー ${email} は既に存在します` };
    }

    if (status === 401 || status === 403) {
      console.error('[GoogleWorkspace] Authentication error:', message);
      return { success: false, error: '認証に失敗しました。GOOGLE_ADMIN_REFRESH_TOKENを確認してください' };
    }

    console.error('[GoogleWorkspace] Error creating user:', message);
    return { success: false, error: message };
  }
}
