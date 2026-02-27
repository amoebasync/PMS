/**
 * Google Calendar API を使用して Google Meet リンク付きの予定を作成する
 * 
 * 必要な環境変数:
 * - GOOGLE_CLIENT_ID: OAuth クライアントID
 * - GOOGLE_CLIENT_SECRET: OAuth クライアントシークレット
 * - GOOGLE_REFRESH_TOKEN: リフレッシュトークン（初回は手動で取得が必要）
 * - GOOGLE_CALENDAR_EMAIL: カレンダー所有者のメールアドレス（オプション）
 */

import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

/**
 * Google Meet リンク付きのカレンダー予定を作成する
 * 
 * @param title - 予定のタイトル
 * @param description - 予定の説明
 * @param startTime - 開始時刻（Date または ISO文字列）
 * @param endTime - 終了時刻（Date または ISO文字列）
 * @param attendeeEmail - 参加者のメールアドレス（オプション）
 * @returns Google Meet の URL、または null（設定がない場合やエラー時）
 */
export async function createGoogleMeetEvent(
  title: string,
  description: string,
  startTime: Date | string,
  endTime: Date | string,
  attendeeEmail?: string
): Promise<string | null> {
  // 環境変数が設定されていない場合は null を返す
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.log('[Google Meet] API credentials not configured, skipping Meet creation');
    return null;
  }

  try {
    // OAuth2 クライアントを作成
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      'https://developers.google.com/oauthplayground' // リダイレクトURI
    );

    // リフレッシュトークンを設定
    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    // Calendar API クライアントを作成
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // カレンダーイベントを作成
    const event = {
      summary: title,
      description: description,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1日前
          { method: 'popup', minutes: 30 },      // 30分前
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: attendeeEmail ? 'all' : 'none',
    });

    // Meet リンクを取得
    const meetUrl = response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri;

    if (meetUrl) {
      console.log('[Google Meet] Event created with Meet URL:', meetUrl);
      return meetUrl;
    }

    console.log('[Google Meet] Event created but no Meet URL found');
    return null;
  } catch (error: any) {
    console.error('[Google Meet] Error creating event:', error.message || error);
    
    // 認証エラーの場合は詳細をログ出力
    if (error.code === 401 || error.code === 403) {
      console.error('[Google Meet] Authentication error. Please check your credentials.');
      console.error('[Google Meet] Make sure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set correctly.');
    }
    
    return null;
  }
}

/**
 * 環境変数が設定されているかチェック
 */
export function isGoogleMeetConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}
