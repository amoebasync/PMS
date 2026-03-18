import crypto from 'crypto';

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/** LINE API にリクエストを送信 */
async function lineApiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
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
    .createHmac('SHA256', CHANNEL_SECRET)
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

/** フォロワーIDを全件取得（ページネーション対応） */
export async function getAllFollowerIds(): Promise<string[]> {
  const allIds: string[] = [];
  let start: string | undefined;

  do {
    const params = start ? `?start=${start}` : '';
    const data = await lineApiFetch(`/followers/ids${params}`);
    allIds.push(...(data.userIds || []));
    start = data.next;
  } while (start);

  return allIds;
}

/** LINE設定が有効か確認 */
export function isLineConfigured(): boolean {
  return !!CHANNEL_ACCESS_TOKEN && !!CHANNEL_SECRET;
}
