/**
 * 社員勤怠インポート + 給与計算・確定スクリプト
 *
 * Usage: npx tsx scripts/import-employee-attendance.ts
 *
 * 1. CSVデータからattendanceレコードをAPPROVED状態で作成
 * 2. 対象月の給与を計算してCONFIRMED状態で保存
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── CSVデータ（TSV形式）───
const RAW_DATA = `NBF1003	Hibiki Fujii	2026-01-12	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-01-13	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-01-14	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-01-15	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-01-16	8:00	17:00	60	8
NBF1005	Asumi Shimura	2026-01-16	15:00	0:00	60	8
NBF1009	Wei Dai	2026-01-19	8:00	17:00	60	8
NBF1011	Thomas Owen	2026-01-19	10:30	18:30	0	8
NBF1008	Angelica Ortiz	2026-01-15	13:30	16:00	0	2.5
NBF1008	Angelica Ortiz	2026-01-19	13:00	19:00	120	4
NBF1005	Asumi Shimura	2026-01-19	15:00	0:00	60	8
NBF1008	Angelica Ortiz	2026-01-20	14:30	15:30	0	1
NBF1009	Wei Dai	2026-01-20	8:00	17:00	60	8
NBF1011	Thomas Owen	2026-01-20	10:00	19:05	0	9.08
NBF1005	Asumi Shimura	2026-01-20	15:00	0:00	60	8
NBF1008	Angelica Ortiz	2026-01-21	13:00	16:30	0	3.5
NBF1005	Asumi Shimura	2026-01-12	15:00	0:00	60	8
NBF1005	Asumi Shimura	2026-01-13	15:00	0:00	60	8
NBF1005	Asumi Shimura	2026-01-14	15:00	0:00	60	8
NBF1005	Asumi Shimura	2026-01-15	15:00	0:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-12	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-13	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-14	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-15	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-16	8:00	17:00	60	8
NBF1006	Akter Mahmuda	2026-01-11	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-12	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-14	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-15	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-16	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-17	7:00	11:00	0	4
NBF1005	Asumi Shimura	2026-01-21	15:00	0:00	60	8
NBF1008	Angelica Ortiz	2026-01-22	13:00	14:30	0	1.5
NBF1008	Angelica Ortiz	2026-01-22	16:00	16:30	0	0.5
NBF1011	Thomas Owen	2026-01-22	10:00	17:46	0	7.77
NBF1005	Asumi Shimura	2026-01-22	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-01-23	10:00	13:00	0	3
NBF1008	Angelica Ortiz	2026-01-23	13:00	14:00	0	1
NBF1005	Asumi Shimura	2026-01-23	15:00	0:00	60	8
NBF1007	Ino Junya	2026-01-24	8:00	15:00	0	7
NBF1007	Ino Junya	2026-01-25	8:00	15:00	0	7
NBF1011	Thomas Owen	2026-01-24	9:45	13:05	0	3.33
NBF1002	Reuben Kanekiyo	2026-01-19	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-20	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-21	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-01-22	9:15	17:00	60	6.75
NBF1002	Reuben Kanekiyo	2026-01-23	8:00	17:30	60	8.5
NBF1008	Angelica Ortiz	2026-01-26	13:30	14:30	0	1
NBF1012	Erfun Ackley	2026-01-22	11:00	17:30	20	6.17
NBF1012	Erfun Ackley	2026-01-23	9:30	18:00	15	8.25
NBF1006	Akter Mahmuda	2026-01-18	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-19	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-21	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-22	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-23	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-01-24	7:00	11:00	0	4
NBF1011	Thomas Owen	2026-01-26	10:00	19:30	60	8.5
NBF1010	Yui Fujii	2026-01-26	14:00	19:00	0	5
NBF1005	Asumi Shimura	2026-01-26	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-01-27	10:00	18:30	30	8
NBF1010	Yui Fujii	2026-01-27	13:00	18:03	0	5.05
NBF1005	Asumi Shimura	2026-01-27	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-01-28	10:00	13:00	0	3
NBF1008	Angelica Ortiz	2026-01-28	13:00	14:30	0	1.5
NBF1010	Yui Fujii	2026-01-28	13:00	18:00	0	5
NBF1012	Erfun Ackley	2026-01-28	9:45	18:00	30	7.75
NBF1012	Erfun Ackley	2026-01-27	9:35	15:30	10	5.75
NBF1012	Erfun Ackley	2026-01-26	9:40	17:00	15	7.08
NBF1005	Asumi Shimura	2026-01-28	15:00	0:00	60	8
NBF1008	Angelica Ortiz	2026-01-29	13:00	15:30	0	2.5
NBF1011	Thomas Owen	2026-01-29	10:00	18:07	30	7.62
NBF1010	Yui Fujii	2026-01-29	13:00	18:00	0	5
NBF1005	Asumi Shimura	2026-01-29	15:00	0:00	60	8
NBF1012	Erfun Ackley	2026-01-29	9:45	18:00	15	8
NBF1011	Thomas Owen	2026-01-30	10:00	13:10	0	3.17
NBF1008	Angelica Ortiz	2026-01-30	16:00	16:30	0	0.5
NBF1010	Yui Fujii	2026-01-30	13:00	18:00	0	5
NBF1005	Asumi Shimura	2026-01-30	15:00	0:00	60	8
NBF1013	Mitsuhashi Elizabeth	2026-01-25	8:00	17:00	60	8
NBF1012	Erfun Ackley	2026-01-30	9:50	19:00	20	8.83
NBF1013	Mitsuhashi Elizabeth	2026-01-31	8:00	17:00	60	8
NBF1013	Mitsuhashi Elizabeth	2026-02-01	8:00	17:00	60	8
NBF1008	Angelica Ortiz	2026-02-02	13:00	15:30	0	2.5
NBF1011	Thomas Owen	2026-02-02	10:00	18:30	30	8
NBF1010	Yui Fujii	2026-02-02	13:00	18:00	0	5
NBF1005	Asumi Shimura	2026-02-02	15:00	0:00	60	8
NBF1008	Angelica Ortiz	2026-02-03	14:30	16:30	0	2
NBF1010	Yui Fujii	2026-02-03	13:00	18:00	0	5
NBF1011	Thomas Owen	2026-02-03	10:00	19:40	15	9.42
NBF1011	Thomas Owen	2026-02-04	9:50	12:50	0	3
NBF1010	Yui Fujii	2026-02-04	13:00	18:00	0	5
NBF1008	Angelica Ortiz	2026-02-04	15:00	15:30	0	0.5
NBF1012	Erfun Ackley	2026-02-03	10:30	16:00	15	5.25
NBF1012	Erfun Ackley	2026-02-04	10:30	16:40	15	5.92
NBF1008	Angelica Ortiz	2026-02-05	14:00	15:30	0	1.5
NBF1010	Yui Fujii	2026-02-05	13:00	18:00	0	5
NBF1011	Thomas Owen	2026-02-05	10:00	19:45	15	9.5
NBF1005	Asumi Shimura	2026-02-05	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-02-06	10:00	13:30	0	3.5
NBF1010	Yui Fujii	2026-02-06	13:00	18:00	0	5
NBF1005	Asumi Shimura	2026-02-06	15:00	0:00	60	8
NBF1013	Mitsuhashi Elizabeth	2026-02-07	8:00	17:00	60	8
NBF1013	Mitsuhashi Elizabeth	2026-02-08	8:00	17:00	60	8
NBF1007	Ino Junya	2026-02-07	8:00	15:00	0	7
NBF1007	Ino Junya	2026-02-08	8:00	15:00	0	7
NBF1012	Erfun Ackley	2026-02-07	13:00	18:40	0	5.67
NBF1012	Erfun Ackley	2026-02-06	10:15	17:25	15	6.92
NBF1012	Erfun Ackley	2026-02-05	10:30	16:45	20	5.92
NBF1012	Erfun Ackley	2026-02-04	10:30	16:40	20	5.83
NBF1012	Erfun Ackley	2026-02-03	10:30	16:00	15	5.25
NBF1008	Angelica Ortiz	2026-02-09	13:00	14:30	0	1.5
NBF1011	Thomas Owen	2026-02-09	10:00	19:55	30	9.42
NBF1010	Yui Fujii	2026-02-09	13:00	18:00	0	5
NBF1005	Asumi Shimura	2026-02-09	15:00	0:00	60	8
NBF1012	Erfun Ackley	2026-02-09	10:20	17:50	0	7.5
NBF1008	Angelica Ortiz	2026-02-10	13:00	14:30	0	1.5
NBF1012	Erfun Ackley	2026-02-10	21:40	15:00	10	17.17
NBF1011	Thomas Owen	2026-02-10	10:00	18:45	30	8.25
NBF1005	Asumi Shimura	2026-02-10	15:00	0:00	60	8
NBF1010	Yui Fujii	2026-02-10	13:00	18:00	0	5
NBF1011	Thomas Owen	2026-02-11	9:00	12:28	0	3.47
NBF1008	Angelica Ortiz	2026-02-11	13:00	15:00	0	2
NBF1005	Asumi Shimura	2026-02-11	15:00	0:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-02	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-03	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-02	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-03	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-04	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-05	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-06	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-09	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-10	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-11	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-12	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-13	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-16	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-17	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-18	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-19	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-20	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-23	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-24	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-25	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-26	8:00	17:00	60	8
NBF1003	Hibiki Fujii	2026-02-27	8:00	17:00	60	8
NBF1006	Akter Mahmuda	2026-02-01	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-02	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-04	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-05	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-06	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-07	7:00	11:00	0	4
NBF1008	Angelica Ortiz	2026-02-12	13:00	16:00	0	3
NBF1011	Thomas Owen	2026-02-12	10:00	18:35	30	8.08
NBF1010	Yui Fujii	2026-02-12	13:00	18:00	0	5
NBF1005	Asumi Shimura	2026-02-12	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-02-13	10:00	13:00	0	3
NBF1008	Angelica Ortiz	2026-02-13	13:00	15:30	0	2.5
NBF1010	Yui Fujii	2026-02-13	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-02-13	15:00	0:00	60	8
NBF1007	Ino Junya	2026-02-07	8:00	15:00	0	7
NBF1007	Ino Junya	2026-02-08	8:00	15:00	0	7
NBF1012	Erfun Ackley	2026-02-13	9:25	19:20	15	9.67
NBF1012	Erfun Ackley	2026-02-11	10:30	18:15	10	7.58
NBF1013	Mitsuhashi Elizabeth	2026-02-14	8:00	17:00	60	8
NBF1010	Yui Fujii	2026-02-14	18:00	21:00	0	3
NBF1013	Mitsuhashi Elizabeth	2026-02-15	8:00	17:00	60	8
NBF1010	Yui Fujii	2026-02-15	15:00	17:00	0	2
NBF1002	Reuben Kanekiyo	2026-02-09	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-10	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-11	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-12	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-13	8:00	17:00	60	8
NBF1011	Thomas Owen	2026-02-16	9:45	17:30	30	7.25
NBF1010	Yui Fujii	2026-02-16	18:00	21:00	0	3
NBF1005	Asumi Shimura	2026-02-16	15:00	0:00	60	8
NBF1008	Angelica Ortiz	2026-02-16	13:00	16:00	0	3
NBF1008	Angelica Ortiz	2026-02-17	12:00	16:30	0	4.5
NBF1011	Thomas Owen	2026-02-17	9:50	18:05	30	7.75
NBF1005	Asumi Shimura	2026-02-17	15:00	0:00	60	8
NBF1010	Yui Fujii	2026-02-17	15:00	18:00	0	3
NBF1011	Thomas Owen	2026-02-18	9:05	13:10	0	4.08
NBF1008	Angelica Ortiz	2026-02-18	13:00	16:30	0	3.5
NBF1010	Yui Fujii	2026-02-18	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-02-18	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-02-19	9:30	18:35	30	8.58
NBF1010	Yui Fujii	2026-02-19	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-02-19	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-02-20	9:00	13:30	0	4.5
NBF1008	Angelica Ortiz	2026-02-20	15:00	16:30	0	1.5
NBF1010	Yui Fujii	2026-02-20	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-02-20	15:00	0:00	60	8
NBF1007	Ino Junya	2026-02-15	8:00	15:00	0	7
NBF1007	Ino Junya	2026-02-21	8:00	15:00	0	7
NBF1013	Mitsuhashi Elizabeth	2026-02-21	8:00	17:00	60	8
NBF1010	Yui Fujii	2026-02-21	18:00	21:00	0	3
NBF1007	Ino Junya	2026-02-22	8:00	17:00	0	9
NBF1013	Mitsuhashi Elizabeth	2026-02-22	8:00	17:00	60	8
NBF1010	Yui Fujii	2026-02-22	18:00	21:00	0	3
NBF1006	Akter Mahmuda	2026-02-15	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-16	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-18	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-19	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-20	7:00	11:00	0	4
NBF1006	Akter Mahmuda	2026-02-21	7:00	11:00	0	4
NBF1010	Yui Fujii	2026-02-23	12:00	15:00	0	3
NBF1011	Thomas Owen	2026-02-23	9:20	19:15	30	9.42
NBF1005	Asumi Shimura	2026-02-23	15:00	0:00	60	8
NBF1010	Yui Fujii	2026-02-24	12:00	15:00	0	3
NBF1005	Asumi Shimura	2026-02-24	15:00	0:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-16	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-17	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-18	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-19	8:00	17:00	60	8
NBF1002	Reuben Kanekiyo	2026-02-20	8:00	18:00	60	9
NBF1011	Thomas Owen	2026-02-25	9:50	13:22	0	3.53
NBF1012	Erfun Ackley	2026-02-24	10:20	17:20	0	7
NBF1012	Erfun Ackley	2026-02-23	8:40	17:15	10	8.42
NBF1012	Erfun Ackley	2026-02-21	11:00	13:00	0	2
NBF1012	Erfun Ackley	2026-02-20	10:20	17:30	10	7
NBF1012	Erfun Ackley	2026-02-19	10:00	16:30	0	6.5
NBF1012	Erfun Ackley	2026-02-18	10:20	18:00	15	7.42
NBF1012	Erfun Ackley	2026-02-17	10:20	18:20	10	7.83
NBF1012	Erfun Ackley	2026-02-16	10:00	15:15	0	5.25
NBF1010	Yui Fujii	2026-02-25	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-02-25	15:00	0:00	60	8
NBF1011	Thomas Owen	2026-02-26	9:03	16:10	5	7.03
NBF1005	Asumi Shimura	2026-02-26	15:00	0:00	60	8
NBF1010	Yui Fujii	2026-02-26	15:00	18:00	0	3
NBF1010	Yui Fujii	2026-02-27	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-02-27	15:00	0:00	60	8
NBF1010	Yui Fujii	2026-02-28	19:00	22:00	0	3
NBF1010	Yui Fujii	2026-03-01	15:00	18:00	0	3
NBF1011	Thomas Owen	2026-03-02	9:43	15:02	0	5.32
NBF1010	Yui Fujii	2026-03-02	15:00	18:00	0	3
NBF1005	Asumi Shimura	2026-03-02	15:00	0:00	60	8`;

interface Row {
  staffId: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workHours: number;
}

function parseData(): Row[] {
  return RAW_DATA.trim().split('\n').map(line => {
    const parts = line.split('\t');
    return {
      staffId: parts[0].trim(),
      name: parts[1].trim(),
      date: parts[2].trim(),
      startTime: parts[3].trim(),
      endTime: parts[4].trim(),
      breakMinutes: parseInt(parts[5].trim()) || 0,
      workHours: parseFloat(parts[6].trim()) || 0,
    };
  });
}

// 同一社員・同一日の複数行を合算
function mergeByDate(rows: Row[]): Map<string, Row> {
  const merged = new Map<string, Row>();
  for (const row of rows) {
    const key = `${row.staffId}_${row.date}`;
    const existing = merged.get(key);
    if (existing) {
      // 同日の複数エントリ → 合算
      existing.workHours = Math.round((existing.workHours + row.workHours) * 100) / 100;
      // 最初のエントリの開始時間、最後のエントリの終了時間を使う
      if (row.startTime < existing.startTime) existing.startTime = row.startTime;
      if (row.endTime > existing.endTime || row.endTime === '0:00') existing.endTime = row.endTime;
      existing.breakMinutes += row.breakMinutes;
    } else {
      merged.set(key, { ...row });
    }
  }
  return merged;
}

// 重複データの除外（NBF1012の2/3,2/4は重複あり、NBF1013の2/1は重複あり）
function deduplicateRows(rows: Row[]): Row[] {
  const seen = new Map<string, Row>();
  for (const row of rows) {
    const key = `${row.staffId}_${row.date}_${row.startTime}_${row.endTime}`;
    if (!seen.has(key)) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

async function main() {
  console.log('=== 社員勤怠インポート開始 ===\n');

  // 1. 「通常出勤」の出勤種別を取得
  const workType = await prisma.attendanceType.findFirst({
    where: { code: 'WORK' },
  });
  if (!workType) {
    console.error('ERROR: 出勤種別「WORK」が見つかりません');
    return;
  }
  console.log(`出勤種別: ${workType.name} (ID: ${workType.id})\n`);

  // 2. CSVデータをパース
  const rawRows = parseData();
  const dedupedRows = deduplicateRows(rawRows);
  console.log(`CSV行数: ${rawRows.length}行（重複除去後: ${dedupedRows.length}行）`);

  // 3. staffId → Employee のマッピング（employeeCodeで検索）
  const staffIds = [...new Set(dedupedRows.map(r => r.staffId))];
  console.log(`対象スタッフ: ${staffIds.join(', ')}\n`);

  const employees = await prisma.employee.findMany({
    where: { employeeCode: { in: staffIds } },
    select: { id: true, employeeCode: true, lastNameJa: true, firstNameJa: true, employmentType: true, isActive: true },
  });

  const staffToEmployee = new Map<string, number>();

  for (const emp of employees) {
    if (emp.employeeCode) {
      staffToEmployee.set(emp.employeeCode, emp.id);
      console.log(`  ${emp.employeeCode} → ${emp.lastNameJa} ${emp.firstNameJa} (ID: ${emp.id}, ${emp.employmentType}${emp.isActive ? '' : ', 非アクティブ'})`);
    }
  }

  for (const sid of staffIds) {
    if (!staffToEmployee.has(sid)) {
      const row = dedupedRows.find(r => r.staffId === sid);
      console.error(`  ${sid} (${row?.name}) → マッピング不可！`);
    }
  }

  // 4. 同一日マージ
  const merged = mergeByDate(dedupedRows);
  console.log(`\n合算後レコード数: ${merged.size}件\n`);

  // 5. Attendanceレコード作成
  let created = 0, updated = 0, skipped = 0;

  for (const [, row] of merged) {
    const employeeId = staffToEmployee.get(row.staffId);
    if (!employeeId) {
      skipped++;
      continue;
    }

    // hourlyRateを取得して給与計算
    const fin = await prisma.employeeFinancial.findUnique({
      where: { employeeId },
    });
    const hourlyRate = fin?.hourlyRate || 0;
    const calculatedWage = Math.floor(row.workHours * hourlyRate * workType.wageMultiplier);

    const dateObj = new Date(row.date);

    try {
      const existing = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: dateObj } },
      });

      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId, date: dateObj } },
        create: {
          employeeId,
          date: dateObj,
          attendanceTypeId: workType.id,
          startTime: row.startTime,
          endTime: row.endTime,
          breakMinutes: row.breakMinutes,
          workHours: row.workHours,
          calculatedWage,
          status: 'APPROVED',
          note: `CSV一括インポート (${row.staffId})`,
        },
        update: {
          attendanceTypeId: workType.id,
          startTime: row.startTime,
          endTime: row.endTime,
          breakMinutes: row.breakMinutes,
          workHours: row.workHours,
          calculatedWage,
          status: 'APPROVED',
          note: `CSV一括インポート (${row.staffId})`,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    } catch (err: any) {
      console.error(`  ERROR: ${row.staffId} ${row.date}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n=== 勤怠インポート結果 ===`);
  console.log(`  新規作成: ${created}件`);
  console.log(`  更新: ${updated}件`);
  console.log(`  スキップ: ${skipped}件`);

  // 6. 給与計算 & 確定
  // 対象月: 2026年1月、2月、3月
  const targetMonths = [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
  ];

  console.log('\n=== 給与計算開始 ===\n');

  for (const { year, month } of targetMonths) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // 月末

    console.log(`--- ${year}年${month}月 (${periodStart.toISOString().split('T')[0]} ~ ${periodEnd.toISOString().split('T')[0]}) ---`);

    // 該当月に勤怠がある社員を取得
    const employeeIds = [...staffToEmployee.values()];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        financial: true,
        attendances: {
          where: {
            date: { gte: periodStart, lte: periodEnd },
            status: 'APPROVED',
          },
          include: { attendanceType: true },
        },
        expenses: {
          where: {
            date: { gte: periodStart, lte: periodEnd },
            status: 'APPROVED',
          },
        },
      },
    });

    for (const emp of employees) {
      const fin = emp.financial;
      if (!fin) continue;
      if (emp.attendances.length === 0) continue;

      // 既にCONFIRMED/PAIDの場合はスキップ
      const existing = await prisma.payrollRecord.findUnique({
        where: { employeeId_periodStart_periodEnd: { employeeId: emp.id, periodStart, periodEnd } },
      });
      if (existing && (existing.status === 'CONFIRMED' || existing.status === 'PAID')) {
        console.log(`  ${emp.lastNameJa} ${emp.firstNameJa} → スキップ（既に${existing.status}）`);
        continue;
      }

      let record: any;

      if (emp.employmentType === 'FULL_TIME') {
        // 正社員: 月次計算
        const workingDays = (fin.workingWeekdays || '1,2,3,4,5').split(',').map(Number).filter(Boolean);
        const workingDayDatesSet = new Set<string>();
        const cur = new Date(periodStart);
        while (cur <= periodEnd) {
          const jsDay = cur.getDay(); // 0=日,1=月...6=土
          const isoDay = jsDay === 0 ? 7 : jsDay; // 1=月...7=日
          if (workingDays.includes(isoDay)) {
            workingDayDatesSet.add(cur.toISOString().split('T')[0]);
          }
          cur.setDate(cur.getDate() + 1);
        }

        const coveredDates = new Set<string>();
        let holidayWorkDays = 0;
        for (const att of emp.attendances) {
          const dateStr = new Date(att.date).toISOString().split('T')[0];
          if (att.attendanceType?.isPaid || att.attendanceType?.isWorking) {
            coveredDates.add(dateStr);
          }
          if (att.attendanceType?.isWorking && !workingDayDatesSet.has(dateStr)) {
            holidayWorkDays++;
          }
        }

        let absentDays = 0;
        for (const dateStr of workingDayDatesSet) {
          if (emp.hireDate && new Date(dateStr) < emp.hireDate) continue;
          if (!coveredDates.has(dateStr)) absentDays++;
        }

        const baseSalary = fin.baseSalary || 0;
        const allowance = fin.allowance || 0;
        const workingDaysInPeriod = workingDayDatesSet.size;
        const dailyUnit = workingDaysInPeriod > 0 ? Math.floor(baseSalary / workingDaysInPeriod) : 0;
        const absentDeduction = Math.floor(dailyUnit * absentDays);
        const expenseTotal = emp.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const grossPay = baseSalary + allowance + expenseTotal;
        const healthInsurance = fin.healthInsurance || 0;
        const pensionInsurance = fin.pensionInsurance || 0;
        const employmentInsurance = fin.employmentInsurance || 0;
        const incomeTax = fin.incomeTax || 0;
        const residentTax = fin.residentTax || 0;
        const totalDeductions = absentDeduction + healthInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax;
        const netPay = grossPay - totalDeductions;

        record = {
          employeeId: emp.id,
          employmentType: emp.employmentType,
          periodStart,
          periodEnd,
          paymentCycle: 'MONTHLY',
          baseSalary,
          allowance,
          workingDaysInPeriod,
          absentDays,
          absentDeduction,
          holidayWorkDays,
          expenseTotal,
          totalWorkHours: 0,
          healthInsurance,
          pensionInsurance,
          employmentInsurance,
          incomeTax,
          residentTax,
          grossPay,
          totalDeductions,
          netPay,
          status: 'CONFIRMED',
        };
      } else {
        // アルバイト・業務委託: 月次で集計（週次ではなく月全体）
        let grossPay = 0;
        let totalWorkHours = 0;

        for (const att of emp.attendances) {
          if (!att.attendanceType?.isWorking && !att.attendanceType?.isPaid) continue;
          totalWorkHours += att.workHours || 0;
          if (fin.salaryType === 'DAILY') {
            grossPay += fin.dailyRate || 0;
          } else {
            grossPay += Math.floor((fin.hourlyRate || 0) * (att.workHours || 0));
          }
        }

        const expenseTotal = emp.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        grossPay += expenseTotal;

        const isOutsource = emp.employmentType === 'OUTSOURCE';
        const healthInsurance = isOutsource ? 0 : (fin.healthInsurance || 0);
        const pensionInsurance = isOutsource ? 0 : (fin.pensionInsurance || 0);
        const employmentInsurance = isOutsource ? 0 : (fin.employmentInsurance || 0);
        const incomeTax = isOutsource ? 0 : (fin.incomeTax || 0);
        const residentTax = isOutsource ? 0 : (fin.residentTax || 0);
        const totalDeductions = healthInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax;
        const netPay = grossPay - totalDeductions;

        record = {
          employeeId: emp.id,
          employmentType: emp.employmentType,
          periodStart,
          periodEnd,
          paymentCycle: 'MONTHLY',
          baseSalary: 0,
          allowance: 0,
          workingDaysInPeriod: 0,
          absentDays: 0,
          absentDeduction: 0,
          holidayWorkDays: 0,
          expenseTotal,
          totalWorkHours: Math.round(totalWorkHours * 100) / 100,
          healthInsurance,
          pensionInsurance,
          employmentInsurance,
          incomeTax,
          residentTax,
          grossPay,
          totalDeductions,
          netPay,
          status: 'CONFIRMED',
        };
      }

      await prisma.payrollRecord.upsert({
        where: { employeeId_periodStart_periodEnd: { employeeId: emp.id, periodStart, periodEnd } },
        create: record,
        update: record,
      });

      console.log(`  ${emp.lastNameJa} ${emp.firstNameJa} (${emp.employmentType}): grossPay=${record.grossPay}, netPay=${record.netPay}, hours=${record.totalWorkHours}, status=CONFIRMED`);
    }
  }

  console.log('\n=== 完了 ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
