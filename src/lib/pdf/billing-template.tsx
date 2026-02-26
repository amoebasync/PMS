/**
 * 月次まとめ請求書 PDF テンプレート
 * @react-pdf/renderer — API Routes (Node.js) のみで import すること
 */
import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer';
import path from 'path';
import type { CompanyInfo } from './types';

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public/fonts/NotoSansCJKjp-Bold.otf'),  fontWeight: 700 },
  ],
});

const LOGO_PATH = path.join(process.cwd(), 'public/logo/logo_light.png');

function fmt(n: number) { return n.toLocaleString('ja-JP'); }
function fmtDate(d: Date | null | undefined) {
  if (!d) return '―';
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

// 受注内の個別明細（配布費・印刷費・折り加工費など）
export type BillingLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;     // 税抜
  taxAmount: number;  // 消費税（10%）
  totalAmount: number; // 税込
  unit?: string;
};

export type BillingOrderItem = {
  orderNo: string;
  title: string | null;
  subtotal: number;
  taxAmount: number;
  amount: number;
  lineItems: BillingLineItem[]; // 配布・印刷・折り加工など（0円除外済み）
};

export type BillingStatementData = {
  statementNo: string;
  billingMonth: string; // "2026-02"
  issuedAt: Date;
  paymentDueDate?: Date | null;
  customerName: string;
  customerPostalCode?: string | null;
  customerAddress?: string | null;
  contactName?: string | null;
  contactDepartment?: string | null;
  orders: BillingOrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  note?: string | null;
};

// ─── カラム幅定数 ──────────────────────────────────────────
// A4 コンテンツ幅 = 595 - 72(padding×2) = 523px
// 固定列計: 52+62+70+52+74 = 310px  → flex:1 = 213px
const COL = {
  qty:   52,
  price: 62,
  sub:   70,
  tax:   52,
  amt:   74,
};

const S = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    color: '#0f172a',
    paddingHorizontal: 36,
    paddingVertical: 36,
    backgroundColor: '#ffffff',
  },

  // ── ヘッダー
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  issuerBlock: { flex: 1 },
  logo: { width: 90, height: 26, marginBottom: 8 },
  issuerName: { fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  issuerSub:  { fontSize: 9, fontWeight: 700, color: '#1e293b', lineHeight: 1.6 },
  docTitleBlock: { alignItems: 'flex-end', minWidth: 200 },
  docTitle: { fontSize: 22, fontWeight: 700, color: '#4f46e5', marginBottom: 4 },
  docSub:   { fontSize: 9, fontWeight: 700, color: '#1e293b', marginBottom: 2 },

  divider: { height: 1, backgroundColor: '#cbd5e1', marginBottom: 14 },

  // ── 宛先・メタ
  metaRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  toBlock:  { flex: 1 },
  toLabel:  { fontSize: 9, fontWeight: 700, color: '#334155', marginBottom: 3 },
  toName:   { fontSize: 14, fontWeight: 700, color: '#0f172a', borderBottom: '1 solid #0f172a', paddingBottom: 3, marginBottom: 5 },
  toAddress:{ fontSize: 9, fontWeight: 700, color: '#1e293b', lineHeight: 1.5 },
  toContact:{ fontSize: 9, fontWeight: 700, color: '#1e293b', marginTop: 1 },
  metaBlock:{ minWidth: 190, alignItems: 'flex-end' },
  metaLine: { flexDirection: 'row', justifyContent: 'space-between', width: 190, marginBottom: 3 },
  metaLabel:{ fontSize: 9, fontWeight: 700, color: '#334155' },
  metaValue:{ fontSize: 9, fontWeight: 700, color: '#0f172a' },

  greeting: { fontSize: 9, fontWeight: 700, color: '#1e293b', marginBottom: 10 },

  // ── 合計ボックス
  totalBox: { backgroundColor: '#eef2ff', borderRadius: 4, padding: '8 12', marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBoxLabel:  { fontSize: 10, fontWeight: 700, color: '#4338ca' },
  totalBoxAmount: { fontSize: 18, fontWeight: 700, color: '#4338ca' },

  // ── テーブル共通
  table: { marginBottom: 12 },

  // テーブルヘッダー行
  tableHead: {
    flexDirection: 'row', backgroundColor: '#334155',
    borderRadius: 2, paddingVertical: 5, paddingHorizontal: 6,
    marginBottom: 0,
  },
  thContent: { flex: 1,         fontSize: 8, fontWeight: 700, color: '#ffffff' },
  thQty:     { width: COL.qty,  fontSize: 8, fontWeight: 700, color: '#ffffff', textAlign: 'right' },
  thPrice:   { width: COL.price,fontSize: 8, fontWeight: 700, color: '#ffffff', textAlign: 'right' },
  thSub:     { width: COL.sub,  fontSize: 8, fontWeight: 700, color: '#ffffff', textAlign: 'right' },
  thTax:     { width: COL.tax,  fontSize: 8, fontWeight: 700, color: '#ffffff', textAlign: 'right' },
  thAmt:     { width: COL.amt,  fontSize: 8, fontWeight: 700, color: '#ffffff', textAlign: 'right' },

  // 受注グループヘッダー行（薄い背景）
  orderHead: {
    flexDirection: 'row',
    backgroundColor: '#e8edf5',
    borderTop: '1 solid #cbd5e1',
    paddingVertical: 5, paddingHorizontal: 6,
  },
  orderNo:   { fontSize: 9, fontWeight: 700, color: '#1e293b', marginRight: 10 },
  orderTitle:{ flex: 1, fontSize: 9, fontWeight: 700, color: '#0f172a' },

  // 明細行
  itemRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #e2e8f0',
    paddingVertical: 4, paddingHorizontal: 6,
  },
  tdContent: { flex: 1,          fontSize: 9, fontWeight: 700, color: '#0f172a' },
  tdQty:     { width: COL.qty,   fontSize: 9, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  tdPrice:   { width: COL.price, fontSize: 9, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  tdSub:     { width: COL.sub,   fontSize: 9, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  tdTax:     { width: COL.tax,   fontSize: 9, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  tdAmt:     { width: COL.amt,   fontSize: 9, fontWeight: 700, color: '#0f172a', textAlign: 'right' },

  // 受注小計フッター行
  orderFoot: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1 solid #cbd5e1',
    paddingVertical: 4, paddingHorizontal: 6,
  },
  orderFootLabel: { flex: 1, fontSize: 8, fontWeight: 700, color: '#334155', textAlign: 'right' },
  orderFootSub:   { width: COL.sub,  fontSize: 8, fontWeight: 700, color: '#334155', textAlign: 'right' },
  orderFootTax:   { width: COL.tax,  fontSize: 8, fontWeight: 700, color: '#334155', textAlign: 'right' },
  orderFootAmt:   { width: COL.amt,  fontSize: 9, fontWeight: 700, color: '#1e3a5f', textAlign: 'right' },
  // 小計フッターの空白スペーサー
  orderFootSpacer:{ width: COL.qty + COL.price },

  // ── 合計サマリー
  summarySection: { alignItems: 'flex-end', marginBottom: 14 },
  summaryRow:     { flexDirection: 'row', justifyContent: 'flex-end', width: 210, marginBottom: 3 },
  summaryLabel:   { width: 100, fontSize: 9, fontWeight: 700, color: '#334155', textAlign: 'right', marginRight: 8 },
  summaryValue:   { width: 100, fontSize: 9, fontWeight: 700, color: '#0f172a', textAlign: 'right' },
  summaryDivider: { width: 210, height: 1, backgroundColor: '#94a3b8', marginVertical: 3 },
  summaryTotalLabel:{ width: 100, fontSize: 10, fontWeight: 700, color: '#0f172a', textAlign: 'right', marginRight: 8 },
  summaryTotalValue:{ width: 100, fontSize: 10, fontWeight: 700, color: '#4338ca', textAlign: 'right' },

  // ── 振込先・備考
  bankBox: { borderTop: '1 solid #cbd5e1', paddingTop: 10, marginTop: 4, flexDirection: 'row', gap: 20 },
  bankSection: { flex: 1 },
  bankTitle:   { fontSize: 9, fontWeight: 700, color: '#0f172a', marginBottom: 5 },
  bankRow:     { flexDirection: 'row', marginBottom: 3 },
  bankLabel:   { width: 70, fontSize: 9, fontWeight: 700, color: '#334155' },
  bankValue:   { flex: 1,  fontSize: 9, fontWeight: 700, color: '#0f172a' },
  noteSection: { flex: 1 },
  noteText:    { fontSize: 9, fontWeight: 700, color: '#1e293b', lineHeight: 1.6 },
});

export function BillingStatementPDF({
  company, doc,
}: {
  company: CompanyInfo;
  doc: BillingStatementData;
}) {
  const [y, m] = doc.billingMonth.split('-').map(Number);
  const periodLabel = `${y}年${m}月分`;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ─ ヘッダー ─ */}
        <View style={S.header}>
          <View style={S.issuerBlock}>
            <Image style={S.logo} src={LOGO_PATH} />
            <Text style={S.issuerName}>{company.companyName}</Text>
            {company.companyNameKana && <Text style={S.issuerSub}>{company.companyNameKana}</Text>}
            {company.postalCode && <Text style={S.issuerSub}>〒{company.postalCode}</Text>}
            {company.address    && <Text style={S.issuerSub}>{company.address}</Text>}
            {company.phone      && <Text style={S.issuerSub}>TEL: {company.phone}</Text>}
            {company.invoiceRegistrationNumber && (
              <Text style={S.issuerSub}>登録番号: {company.invoiceRegistrationNumber}</Text>
            )}
          </View>
          <View style={S.docTitleBlock}>
            <Text style={S.docTitle}>請 求 書</Text>
            <Text style={S.docSub}>請求番号: {doc.statementNo}</Text>
            <Text style={S.docSub}>請求期間: {periodLabel}</Text>
            <Text style={S.docSub}>発行日: {fmtDate(doc.issuedAt)}</Text>
            {doc.paymentDueDate && (
              <Text style={S.docSub}>お支払期限: {fmtDate(doc.paymentDueDate)}</Text>
            )}
          </View>
        </View>

        <View style={S.divider} />

        {/* ─ 宛先・請求金額 ─ */}
        <View style={S.metaRow}>
          <View style={S.toBlock}>
            <Text style={S.toLabel}>請求先</Text>
            <Text style={S.toName}>{doc.customerName} 御中</Text>
            {doc.customerPostalCode && <Text style={S.toAddress}>〒{doc.customerPostalCode}</Text>}
            {doc.customerAddress    && <Text style={S.toAddress}>{doc.customerAddress}</Text>}
            {doc.contactDepartment  && <Text style={S.toContact}>{doc.contactDepartment}</Text>}
            {doc.contactName        && <Text style={S.toContact}>{doc.contactName} 様</Text>}
          </View>
          <View style={S.metaBlock}>
            <View style={S.metaLine}>
              <Text style={S.metaLabel}>請求対象</Text>
              <Text style={S.metaValue}>{periodLabel}</Text>
            </View>
            <View style={S.metaLine}>
              <Text style={S.metaLabel}>受注件数</Text>
              <Text style={S.metaValue}>{doc.orders.length} 件</Text>
            </View>
          </View>
        </View>

        {/* ─ 請求金額ハイライト ─ */}
        <View style={S.totalBox}>
          <Text style={S.totalBoxLabel}>ご請求金額（税込）</Text>
          <Text style={S.totalBoxAmount}>¥{fmt(doc.totalAmount)}</Text>
        </View>

        <Text style={S.greeting}>
          下記の通りご請求申し上げます。お手数ですがご確認のほどよろしくお願い申し上げます。
        </Text>

        {/* ─ 受注・明細テーブル ─ */}
        <View style={S.table}>
          {/* テーブルヘッダー */}
          <View style={S.tableHead}>
            <Text style={S.thContent}>受注番号 / 品目・内容</Text>
            <Text style={S.thQty}>数量</Text>
            <Text style={S.thPrice}>単価</Text>
            <Text style={S.thSub}>税抜金額</Text>
            <Text style={S.thTax}>消費税</Text>
            <Text style={S.thAmt}>合計(税込)</Text>
          </View>

          {/* 受注ごとのグループ */}
          {doc.orders.map((order, oi) => (
            <View key={oi}>
              {/* 受注グループヘッダー */}
              <View style={S.orderHead}>
                <Text style={S.orderNo}>{order.orderNo}</Text>
                <Text style={S.orderTitle}>{order.title ?? '（タイトルなし）'}</Text>
              </View>

              {/* 明細行（配布・印刷・折り加工など） */}
              {order.lineItems.map((item, ii) => (
                <View key={ii} style={S.itemRow}>
                  <Text style={S.tdContent}>　{item.description}</Text>
                  <Text style={S.tdQty}>
                    {item.quantity > 0 ? `${fmt(item.quantity)}${item.unit ?? ''}` : ''}
                  </Text>
                  <Text style={S.tdPrice}>
                    {item.unitPrice > 0 ? `¥${fmt(item.unitPrice)}` : '—'}
                  </Text>
                  <Text style={S.tdSub}>¥{fmt(item.amount)}</Text>
                  <Text style={S.tdTax}>¥{fmt(item.taxAmount)}</Text>
                  <Text style={S.tdAmt}>¥{fmt(item.totalAmount)}</Text>
                </View>
              ))}

              {/* 受注小計行 */}
              <View style={S.orderFoot}>
                <Text style={S.orderFootLabel}>受注合計</Text>
                <Text style={S.orderFootSpacer}></Text>
                <Text style={S.orderFootSub}>¥{fmt(order.subtotal)}</Text>
                <Text style={S.orderFootTax}>¥{fmt(order.taxAmount)}</Text>
                <Text style={S.orderFootAmt}>¥{fmt(order.amount)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─ 合計サマリー ─ */}
        <View style={S.summarySection}>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>小計（税抜）</Text>
            <Text style={S.summaryValue}>¥{fmt(doc.subtotal)}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>消費税（10%）</Text>
            <Text style={S.summaryValue}>¥{fmt(doc.taxAmount)}</Text>
          </View>
          <View style={[S.summaryRow, { marginTop: 2 }]}>
            <View style={S.summaryDivider} />
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryTotalLabel}>ご請求合計</Text>
            <Text style={S.summaryTotalValue}>¥{fmt(doc.totalAmount)}</Text>
          </View>
        </View>

        {/* ─ 振込先・備考 ─ */}
        {(company.bankName || doc.note) && (
          <View style={S.bankBox}>
            {company.bankName && (
              <View style={S.bankSection}>
                <Text style={S.bankTitle}>【お振込先】</Text>
                <View style={S.bankRow}><Text style={S.bankLabel}>銀行名</Text><Text style={S.bankValue}>{company.bankName}</Text></View>
                {company.bankBranch       && <View style={S.bankRow}><Text style={S.bankLabel}>支店名</Text><Text style={S.bankValue}>{company.bankBranch}</Text></View>}
                {company.bankAccountType  && <View style={S.bankRow}><Text style={S.bankLabel}>口座種別</Text><Text style={S.bankValue}>{company.bankAccountType}</Text></View>}
                {company.bankAccountNumber && <View style={S.bankRow}><Text style={S.bankLabel}>口座番号</Text><Text style={S.bankValue}>{company.bankAccountNumber}</Text></View>}
                {company.bankAccountHolder && <View style={S.bankRow}><Text style={S.bankLabel}>口座名義</Text><Text style={S.bankValue}>{company.bankAccountHolder}</Text></View>}
              </View>
            )}
            {doc.note && (
              <View style={S.noteSection}>
                <Text style={S.bankTitle}>【備考】</Text>
                <Text style={S.noteText}>{doc.note}</Text>
              </View>
            )}
          </View>
        )}

      </Page>
    </Document>
  );
}
