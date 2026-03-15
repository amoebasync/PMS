/**
 * 配布員支払明細書PDFテンプレート
 * @react-pdf/renderer — API Routes (Node.js) のみで import すること
 */
import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer';
import path from 'path';
import type { CompanyInfo } from './types';

// ─── フォント登録 ───────────────────────────────────────────
Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public/fonts/NotoSansCJKjp-Bold.otf'), fontWeight: 700 },
  ],
});

// ─── 型定義 ──────────────────────────────────────────────────
export type PayrollStatementData = {
  distributorName: string;
  distributorStaffId: string;
  periodLabel: string; // 例: "2026年3月" or "2025年度"
  issuedAt: Date;
  // 月表示（年間の場合は月ごとサマリー）
  rows: PayrollStatementRow[];
  totalSchedulePay: number;
  totalExpensePay: number;
  totalGrossPay: number;
};

export type PayrollStatementRow = {
  label: string;        // "3/1(日)" or "1月"
  description: string;  // 配布内容 or 件数
  schedulePay: number;
  expensePay: number;
  grossPay: number;
};

// ─── スタイル ────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 7,
    color: '#1e293b',
    paddingHorizontal: 30,
    paddingVertical: 24,
    backgroundColor: '#ffffff',
  },
  // ヘッダー
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 4 },
  subTitle: { fontSize: 8, color: '#64748b' },
  // 会社情報（右上）
  companyBlock: { alignItems: 'flex-end', maxWidth: 200 },
  companyName: { fontSize: 9, fontWeight: 700, color: '#0f172a', marginBottom: 1 },
  companyText: { fontSize: 6.5, color: '#475569', lineHeight: 1.5 },
  sealImage: { width: 42, height: 42, marginTop: 4 },
  // 宛先
  toBlock: { marginBottom: 10 },
  toName: { fontSize: 11, fontWeight: 700, color: '#0f172a', borderBottom: '1 solid #334155', paddingBottom: 2, marginBottom: 2 },
  toSub: { fontSize: 7, color: '#64748b' },
  // 期間・発行日
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { fontSize: 7, color: '#475569' },
  // 合計ハイライト
  totalBar: { backgroundColor: '#eff6ff', borderRadius: 4, padding: '6 10', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBarLabel: { fontSize: 9, fontWeight: 700, color: '#1e40af' },
  totalBarAmount: { fontSize: 14, fontWeight: 700, color: '#1e40af' },
  // テーブル
  table: { marginBottom: 6 },
  tHead: { flexDirection: 'row', backgroundColor: '#e2e8f0', paddingVertical: 3, paddingHorizontal: 4, borderTop: '0.5 solid #94a3b8', borderBottom: '0.5 solid #94a3b8' },
  tHeadText: { fontSize: 6.5, fontWeight: 700, color: '#334155' },
  tRow: { flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 4, borderBottom: '0.3 solid #e2e8f0' },
  tRowAlt: { backgroundColor: '#f8fafc' },
  // カラム幅
  colDate: { width: 42 },
  colDesc: { flex: 1 },
  colSchedule: { width: 58, textAlign: 'right' },
  colExpense: { width: 50, textAlign: 'right' },
  colTotal: { width: 58, textAlign: 'right' },
  // フッター合計
  tFoot: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderTop: '1 solid #334155', backgroundColor: '#f1f5f9' },
  tFootText: { fontSize: 7, fontWeight: 700, color: '#0f172a' },
  // 備考
  note: { fontSize: 6.5, color: '#64748b', marginTop: 8, lineHeight: 1.5 },
});

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const fmtDate = (d: Date) =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

// ─── メインコンポーネント ──────────────────────────────────────
export function PayrollStatementPDF({
  company,
  data,
}: {
  company: CompanyInfo;
  data: PayrollStatementData;
}) {
  return (
    <Document title={`支払明細書 ${data.distributorName} ${data.periodLabel}`}>
      <Page size="A4" style={S.page}>
        {/* ヘッダー */}
        <View style={S.header}>
          <View>
            <Text style={S.title}>支 払 明 細 書</Text>
            <Text style={S.subTitle}>Payment Statement</Text>
          </View>
          <View style={S.companyBlock}>
            <Text style={S.companyName}>{company.companyName}</Text>
            {company.representativeName && (
              <Text style={S.companyText}>代表　{company.representativeName}</Text>
            )}
            {company.postalCode && <Text style={S.companyText}>〒{company.postalCode}</Text>}
            {company.address && <Text style={S.companyText}>{company.address}</Text>}
            {company.phone && <Text style={S.companyText}>TEL: {company.phone}</Text>}
            {company.sealImageUrl && (
              <Image src={company.sealImageUrl} style={S.sealImage} />
            )}
          </View>
        </View>

        {/* 宛先 */}
        <View style={S.toBlock}>
          <Text style={S.toName}>{data.distributorName}　殿</Text>
          <Text style={S.toSub}>ID: {data.distributorStaffId}</Text>
        </View>

        {/* 期間・発行日 */}
        <View style={S.metaRow}>
          <Text style={S.metaText}>対象期間: {data.periodLabel}</Text>
          <Text style={S.metaText}>発行日: {fmtDate(data.issuedAt)}</Text>
        </View>

        {/* 合計ハイライト */}
        <View style={S.totalBar}>
          <Text style={S.totalBarLabel}>支給合計</Text>
          <Text style={S.totalBarAmount}>{yen(data.totalGrossPay)}</Text>
        </View>

        {/* 内訳サマリー */}
        <View style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: '#f0f9ff', borderRadius: 3, padding: '4 8' }}>
            <Text style={{ fontSize: 6, color: '#64748b' }}>配布報酬</Text>
            <Text style={{ fontSize: 9, fontWeight: 700, color: '#4f46e5' }}>{yen(data.totalSchedulePay)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 3, padding: '4 8' }}>
            <Text style={{ fontSize: 6, color: '#64748b' }}>交通費</Text>
            <Text style={{ fontSize: 9, fontWeight: 700, color: '#059669' }}>{yen(data.totalExpensePay)}</Text>
          </View>
        </View>

        {/* 明細テーブル */}
        <View style={S.table}>
          <View style={S.tHead}>
            <Text style={[S.tHeadText, S.colDate]}>日付</Text>
            <Text style={[S.tHeadText, S.colDesc]}>内容</Text>
            <Text style={[S.tHeadText, S.colSchedule]}>配布報酬</Text>
            <Text style={[S.tHeadText, S.colExpense]}>交通費</Text>
            <Text style={[S.tHeadText, S.colTotal]}>合計</Text>
          </View>
          {data.rows.map((row, i) => (
            <View key={i} style={[S.tRow, i % 2 === 1 ? S.tRowAlt : {}]}>
              <Text style={[{ fontSize: 6.5, color: '#334155' }, S.colDate]}>{row.label}</Text>
              <Text style={[{ fontSize: 6.5, color: '#64748b' }, S.colDesc]}>{row.description}</Text>
              <Text style={[{ fontSize: 6.5, color: '#4f46e5' }, S.colSchedule]}>
                {row.schedulePay > 0 ? yen(row.schedulePay) : '—'}
              </Text>
              <Text style={[{ fontSize: 6.5, color: '#059669' }, S.colExpense]}>
                {row.expensePay > 0 ? yen(row.expensePay) : '—'}
              </Text>
              <Text style={[{ fontSize: 6.5, fontWeight: 700, color: '#0f172a' }, S.colTotal]}>
                {row.grossPay > 0 ? yen(row.grossPay) : '—'}
              </Text>
            </View>
          ))}
          {/* フッター合計 */}
          <View style={S.tFoot}>
            <Text style={[S.tFootText, S.colDate]}>合計</Text>
            <Text style={[S.tFootText, S.colDesc]}></Text>
            <Text style={[S.tFootText, S.colSchedule]}>{yen(data.totalSchedulePay)}</Text>
            <Text style={[S.tFootText, S.colExpense]}>{yen(data.totalExpensePay)}</Text>
            <Text style={[S.tFootText, S.colTotal]}>{yen(data.totalGrossPay)}</Text>
          </View>
        </View>

        {/* 備考 */}
        <Text style={S.note}>
          ※ 本書は{company.companyName}が発行する支払明細書です。{'\n'}
          ※ 内容に相違がある場合は発行日から14日以内にご連絡ください。
        </Text>
      </Page>
    </Document>
  );
}
