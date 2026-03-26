import crypto from 'crypto';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/** 環境変数を実行時に取得（モジュール初期化時のキャッシュ問題を回避） */
function getAccessToken() { return process.env.LINE_CHANNEL_ACCESS_TOKEN || ''; }
function getChannelSecret() { return process.env.LINE_CHANNEL_SECRET || ''; }

/** LINE API にリクエストを送信 */
async function lineApiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE API error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Webhook 署名を検証 */
export function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', getChannelSecret())
    .update(body)
    .digest('base64');
  return hash === signature;
}

/** ユーザープロフィールを取得 */
export async function getProfile(userId: string): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}> {
  return lineApiFetch(`/profile/${userId}`);
}

/** ブロードキャストメッセージ送信（全フォロワーに送信） */
export async function broadcastMessage(messages: any[]): Promise<void> {
  await lineApiFetch('/message/broadcast', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

/** 特定のユーザーまたはグループにプッシュメッセージ送信 */
export async function pushMessage(to: string, messages: any[]): Promise<void> {
  await lineApiFetch('/message/push', {
    method: 'POST',
    body: JSON.stringify({ to, messages }),
  });
}

/** グループのプロフィール（名前等）を取得 */
export async function getGroupSummary(groupId: string): Promise<{
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}> {
  return lineApiFetch(`/group/${groupId}/summary`);
}

/** 特定ユーザーにリプライメッセージ送信 */
export async function replyMessage(replyToken: string, messages: any[]): Promise<void> {
  await lineApiFetch('/message/reply', {
    method: 'POST',
    body: JSON.stringify({ replyToken, messages }),
  });
}

/** LINE連携依頼 Flex Message（日英バイリンガル） */
export function buildRegistrationFlexMessage() {
  return {
    type: 'flex',
    altText: 'K&Partners 配布員登録 / Distributor Registration',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'K&Partners',
            weight: 'bold',
            size: 'xl',
            color: '#10B981',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          // 日本語
          {
            type: 'text',
            text: '🇯🇵 配布員登録のご案内',
            weight: 'bold',
            size: 'md',
            margin: 'lg',
            color: '#333333',
          },
          {
            type: 'text',
            text: '配布員管理システム（PMS）とLINEアカウントを連携します。下の「登録する」ボタンを押してください。連携後、スケジュールやお知らせをLINEでお届けできるようになります。',
            wrap: true,
            size: 'sm',
            margin: 'md',
            color: '#555555',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          // English
          {
            type: 'text',
            text: '🇬🇧 Distributor Registration',
            weight: 'bold',
            size: 'md',
            margin: 'lg',
            color: '#333333',
          },
          {
            type: 'text',
            text: 'Link your LINE account with the Posting Management System (PMS). Please tap the "Register" button below. After linking, you will receive schedules and notifications via LINE.',
            wrap: true,
            size: 'sm',
            margin: 'md',
            color: '#555555',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '登録する / Register',
              data: 'action=register',
              displayText: '登録します / I will register',
            },
            style: 'primary',
            color: '#10B981',
          },
        ],
      },
    },
  };
}

/** LINE設定が有効か確認 */
export function isLineConfigured(): boolean {
  return !!getAccessToken() && !!getChannelSecret();
}

/** 研修テスト割当の LINE 通知メッセージを構築 */
export function buildTrainingTestMessage(distributorName: string, portalUrl: string) {
  return [
    {
      type: 'text' as const,
      text: `${distributorName}さん\n\n研修テストが届きました。\n以下のリンクから受験してください。\n\nA training test has been assigned to you.\nPlease take the test from the link below.\n\n${portalUrl}/staff/test`
    }
  ];
}
