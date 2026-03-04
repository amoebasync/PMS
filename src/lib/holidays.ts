import holidayJp from '@holiday-jp/holiday_jp';
import { prisma } from '@/lib/prisma';

/**
 * 指定日が祝日かどうかを判定（日本の祝日ライブラリ + カスタム祝日DB）
 */
export async function isHoliday(date: Date): Promise<boolean> {
  // 1) holiday_jp ライブラリで日本の祝日を判定
  if (holidayJp.isHoliday(date)) {
    return true;
  }

  // 2) カスタム祝日テーブルを確認
  const dateOnly = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const custom = await prisma.customHoliday.findFirst({
    where: { date: dateOnly },
  });

  return !!custom;
}

/**
 * 指定範囲内の祝日リストを取得
 */
export async function getHolidaysInRange(
  start: Date,
  end: Date
): Promise<Array<{ date: Date; name: string }>> {
  const holidays: Array<{ date: Date; name: string }> = [];

  // holiday_jp ライブラリから範囲内の祝日を取得
  const jpHolidays = holidayJp.between(start, end);
  for (const h of jpHolidays) {
    holidays.push({ date: h.date, name: h.name });
  }

  // カスタム祝日DBから範囲内を取得
  const customHolidays = await prisma.customHoliday.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    orderBy: { date: 'asc' },
  });

  for (const ch of customHolidays) {
    // 重複チェック（同じ日付がライブラリにもある場合はスキップ）
    const alreadyExists = holidays.some(
      (h) => h.date.toISOString().split('T')[0] === ch.date.toISOString().split('T')[0]
    );
    if (!alreadyExists) {
      holidays.push({ date: ch.date, name: ch.name });
    }
  }

  // 日付順にソート
  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

  return holidays;
}
