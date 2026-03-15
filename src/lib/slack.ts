/**
 * Slack Webhook ユーティリティ
 */

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: { type: string; text: string; emoji?: boolean }[];
  fields?: { type: string; text: string }[];
}

/**
 * Slack Webhook にブロックメッセージを送信
 */
async function sendSlackBlocks(webhookUrl: string, blocks: SlackBlock[]): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      console.error('Slack webhook error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Slack webhook error:', error);
    return false;
  }
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * シフト提出時の Slack 通知を送信
 */
export async function sendShiftNotification(params: {
  distributorName: string;
  branchName: string;
  weekStart: string; // YYYY-MM-DD (月曜日)
  weekEnd: string;   // YYYY-MM-DD (日曜日)
  days: { date: string; working: boolean; note?: string | null }[];
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_SHIFT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('SLACK_SHIFT_WEBHOOK_URL not set, skipping Slack notification');
    return false;
  }

  const { distributorName, branchName, weekStart, weekEnd, days } = params;

  // 提出日時 (JST)
  const now = new Date();
  const submittedAt = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 週の表示 (MM/DD)
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  // 勤務希望日リスト
  const dayLines = days.map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    const dayName = DAY_NAMES[dt.getDay()];
    const emoji = d.working ? '⭕' : '➖';
    const label = d.working ? '出勤' : '';
    const noteStr = d.working && d.note ? ` 💬 ${d.note}` : '';
    return `${emoji} ${fmtDate(d.date)}（${dayName}）${label}${noteStr}`;
  }).join('\n');

  // コメント集約
  const comments = days.filter(d => d.working && d.note).map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return `${fmtDate(d.date)}（${DAY_NAMES[dt.getDay()]}）: ${d.note}`;
  });
  const commentText = comments.length > 0 ? comments.join('\n') : 'なし';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🆕 新規シフト提出', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*👤 氏名:*\n${distributorName}` },
        { type: 'mrkdwn', text: `*🏢 支店:*\n${branchName}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*📅 対象週:*\n${fmtDate(weekStart)}〜${fmtDate(weekEnd)}` },
        { type: 'mrkdwn', text: `*⏰ 提出日時:*\n${submittedAt}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📋 勤務希望日:*\n${dayLines}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📝 コメント:*\n${commentText}` },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '👇 対応完了したら、このメッセージに ✅ スタンプを押してください' },
      ],
    },
  ];

  return sendSlackBlocks(webhookUrl, blocks);
}

/**
 * シフト取消時の Slack 通知を送信
 */
export async function sendShiftCancelNotification(params: {
  distributorName: string;
  branchName: string;
  cancelledDates: string[]; // YYYY-MM-DD[]
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_SHIFT_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const { distributorName, branchName, cancelledDates } = params;

  const now = new Date();
  const submittedAt = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateLines = cancelledDates.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return `❌ ${dt.getMonth() + 1}/${dt.getDate()}（${DAY_NAMES[dt.getDay()]}）`;
  }).join('\n');

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔴 シフト取消', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*👤 氏名:*\n${distributorName}` },
        { type: 'mrkdwn', text: `*🏢 支店:*\n${branchName}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📅 取消日:*\n${dateLines}` },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `⏰ ${submittedAt}` },
      ],
    },
  ];

  return sendSlackBlocks(webhookUrl, blocks);
}
