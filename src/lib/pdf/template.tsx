/**
 * 帳票PDFテンプレート（見積書・請求書・納品書・領収書）
 * @react-pdf/renderer を使用 — API Routes (Node.js) のみで import すること
 */
import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer';
import path from 'path';
import type { CompanyInfo, DocumentData } from './types';

// ─── フォント登録 ───────────────────────────────────────────
Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public/fonts/NotoSansCJKjp-Bold.otf'), fontWeight: 700 },
  ],
});

// ─── ロゴパス ────────────────────────────────────────────────
const LOGO_PATH = path.join(process.cwd(), 'public/logo/logo_light.png');

// ─── スタイル定義 ──────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    color: '#0f172a',
    paddingHorizontal: 36,
    paddingVertical: 36,
    backgroundColor: '#ffffff',
  },
  /* ヘッダー */
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  issuerBlock: { flex: 1 },
  logo: { width: 90, height: 26, marginBottom: 8 },
  issuerName: { fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  issuerSub: { fontSize: 8, color: '#334155', lineHeight: 1.6 },
  docTitleBlock: { alignItems: 'flex-end', minWidth: 200 },
  docTitle: { fontSize: 20, fontWeight: 700, color: '#4f46e5', marginBottom: 4 },
  docNo: { fontSize: 8, color: '#334155' },
  docDate: { fontSize: 8, color: '#334155' },
  /* 宛先・発行日セクション */
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  toBlock: { flex: 1 },
  toLabel: { fontSize: 8, color: '#475569', marginBottom: 2 },
  toName: { fontSize: 13, fontWeight: 700, color: '#0f172a', borderBottom: '1 solid #0f172a', paddingBottom: 2, marginBottom: 4 },
  toAddress: { fontSize: 8, color: '#334155', lineHeight: 1.5 },
  toContact: { fontSize: 8, color: '#334155', marginTop: 1 },
  metaBlock: { minWidth: 180, alignItems: 'flex-end' },
  metaRow2: { flexDirection: 'row', justifyContent: 'space-between', width: 180, marginBottom: 2 },
  metaLabel: { fontSize: 8, color: '#475569' },
  metaValue: { fontSize: 8, color: '#0f172a' },
  /* 挨拶文 */
  greeting: { fontSize: 8, color: '#334155', marginBottom: 12 },
  /* 合計金額ハイライト */
  totalHighlight: { backgroundColor: '#eef2ff', borderRadius: 4, padding: '8 12', marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalHighlightLabel: { fontSize: 10, fontWeight: 700, color: '#4338ca' },
  totalHighlightAmount: { fontSize: 16, fontWeight: 700, color: '#4338ca' },
  /* テーブル */
  table: { marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderTop: '1 solid #94a3b8', borderBottom: '1 solid #94a3b8', paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderText: { fontSize: 8, fontWeight: 700, color: '#0f172a' },
  tableRow: { flexDirection: 'row', borderBottom: '0.5 solid #cbd5e1', paddingVertical: 5, paddingHorizontal: 4 },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  // カラム幅
  colDesc: { flex: 4 },
  colQty: { width: 50, textAlign: 'right' },
  colUnit: { width: 25, textAlign: 'center' },
  colUnitPrice: { width: 70, textAlign: 'right' },
  colAmount: { width: 75, textAlign: 'right' },
  /* 小計エリア */
  subtotalArea: { alignItems: 'flex-end', marginBottom: 12 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'flex-end', width: 220, marginBottom: 2 },
  subtotalLabel: { fontSize: 8, color: '#475569', width: 110 },
  subtotalValue: { fontSize: 8, color: '#0f172a', width: 110, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', width: 220, paddingTop: 4, borderTop: '1 solid #0f172a' },
  totalLabel: { fontSize: 10, fontWeight: 700, width: 110 },
  totalValue: { fontSize: 10, fontWeight: 700, width: 110, textAlign: 'right', color: '#4338ca' },
  /* 備考・振込先 */
  sectionTitle: { fontSize: 9, fontWeight: 700, color: '#0f172a', borderBottom: '0.5 solid #94a3b8', paddingBottom: 3, marginBottom: 6, marginTop: 12 },
  sectionText: { fontSize: 8, color: '#1e293b', lineHeight: 1.6 },
  /* 領収書専用 */
  receiptAmount: { fontSize: 28, fontWeight: 700, color: '#0f172a', textAlign: 'center', marginVertical: 16 },
  receiptCenter: { alignItems: 'center' },
  stamp: { width: 60, height: 60, borderRadius: 30, border: '2 solid #dc2626', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 8 },
  stampText: { color: '#dc2626', fontWeight: 700, fontSize: 10 },
  /* 登録番号 */
  invoiceRegNo: { fontSize: 7, color: '#334155', marginTop: 2 },
});

// ─── 共通ヘルパー ──────────────────────────────────────────
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const fmtDate = (d: Date) =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

// ─── 発行元ブロック（ロゴ付き） ──────────────────────────────
function IssuerBlock({ c }: { c: CompanyInfo }) {
  return (
    <View style={S.issuerBlock}>
      <Image src={LOGO_PATH} style={S.logo} />
      <Text style={S.issuerName}>{c.companyName}</Text>
      {c.companyNameKana && <Text style={S.issuerSub}>{c.companyNameKana}</Text>}
      {c.postalCode && <Text style={S.issuerSub}>〒{c.postalCode}</Text>}
      {c.address && <Text style={S.issuerSub}>{c.address}</Text>}
      {c.phone && <Text style={S.issuerSub}>TEL: {c.phone}</Text>}
      {c.fax && <Text style={S.issuerSub}>FAX: {c.fax}</Text>}
      {c.email && <Text style={S.issuerSub}>{c.email}</Text>}
      {c.invoiceRegistrationNumber && (
        <Text style={S.invoiceRegNo}>登録番号: {c.invoiceRegistrationNumber}</Text>
      )}
    </View>
  );
}

// ─── 宛先ブロック（住所付き） ─────────────────────────────────
function ToBlock({
  label, doc,
}: { label: string; doc: DocumentData; honorific?: string }) {
  return (
    <View style={S.toBlock}>
      <Text style={S.toLabel}>{label}</Text>
      <Text style={S.toName}>{doc.customerName}　御中</Text>
      {doc.customerPostalCode && (
        <Text style={S.toAddress}>〒{doc.customerPostalCode}</Text>
      )}
      {doc.customerAddress && (
        <Text style={S.toAddress}>{doc.customerAddress}</Text>
      )}
      {doc.contactDepartment && (
        <Text style={S.toContact}>{doc.contactDepartment}</Text>
      )}
      {doc.contactName && (
        <Text style={S.toContact}>{doc.contactName}　様</Text>
      )}
    </View>
  );
}

// ─── 受注情報ブロック ─────────────────────────────────────────
function OrderMetaBlock({ doc }: { doc: DocumentData; extra?: React.ReactNode }) {
  return (
    <View style={S.metaBlock}>
      <View style={S.metaRow2}>
        <Text style={S.metaLabel}>受注番号</Text>
        <Text style={S.metaValue}>{doc.orderNo}</Text>
      </View>
      {doc.orderTitle && (
        <View style={S.metaRow2}>
          <Text style={S.metaLabel}>件名</Text>
          <Text style={S.metaValue}>{doc.orderTitle.slice(0, 20)}</Text>
        </View>
      )}
    </View>
  );
}

// ─── 品目テーブル ──────────────────────────────────────────
function LineItemsTable({ items }: { items: DocumentData['lineItems'] }) {
  return (
    <View style={S.table}>
      <View style={S.tableHeader}>
        <Text style={[S.tableHeaderText, S.colDesc]}>品目・内容</Text>
        <Text style={[S.tableHeaderText, S.colQty]}>数量</Text>
        <Text style={[S.tableHeaderText, S.colUnit]}>単位</Text>
        <Text style={[S.tableHeaderText, S.colUnitPrice]}>単価</Text>
        <Text style={[S.tableHeaderText, S.colAmount]}>金額</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
          <Text style={[{ fontSize: 9, color: '#0f172a' }, S.colDesc]}>{item.description}</Text>
          <Text style={[{ fontSize: 9, color: '#0f172a' }, S.colQty]}>{item.quantity.toLocaleString('ja-JP')}</Text>
          <Text style={[{ fontSize: 8, color: '#475569' }, S.colUnit]}>{item.unit ?? '式'}</Text>
          <Text style={[{ fontSize: 9, color: '#0f172a' }, S.colUnitPrice]}>
            {item.unitPrice > 0 ? `¥${item.unitPrice.toLocaleString('ja-JP')}` : '—'}
          </Text>
          <Text style={[{ fontSize: 9, color: '#0f172a' }, S.colAmount]}>
            {item.amount > 0 ? yen(item.amount) : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── 小計エリア ────────────────────────────────────────────
function SubtotalArea({ d }: { d: DocumentData }) {
  return (
    <View style={S.subtotalArea}>
      <View style={S.subtotalRow}>
        <Text style={S.subtotalLabel}>小計</Text>
        <Text style={S.subtotalValue}>{yen(d.subtotal)}</Text>
      </View>
      <View style={S.subtotalRow}>
        <Text style={S.subtotalLabel}>消費税（{Math.round(d.taxRate * 100)}%）</Text>
        <Text style={S.subtotalValue}>{yen(d.taxAmount)}</Text>
      </View>
      <View style={S.totalRow}>
        <Text style={S.totalLabel}>合計金額</Text>
        <Text style={S.totalValue}>{yen(d.totalAmount)}</Text>
      </View>
    </View>
  );
}

// ─── 振込先 ────────────────────────────────────────────────
function BankInfo({ c }: { c: CompanyInfo }) {
  if (!c.bankName) return null;
  return (
    <View>
      <Text style={S.sectionTitle}>お振込先</Text>
      <Text style={S.sectionText}>
        {c.bankName} {c.bankBranch}　{c.bankAccountType}　{c.bankAccountNumber}{'\n'}
        口座名義：{c.bankAccountHolder}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. 見積書（振込先なし）
// ─────────────────────────────────────────────────────────────
export function EstimatePDF({ company, doc }: { company: CompanyInfo; doc: DocumentData }) {
  return (
    <Document title={`見積書 ${doc.documentNo}`}>
      <Page size="A4" style={S.page}>
        {/* ヘッダー */}
        <View style={S.header}>
          <IssuerBlock c={company} />
          <View style={S.docTitleBlock}>
            <Text style={S.docTitle}>見 積 書</Text>
            <Text style={S.docNo}>No: {doc.documentNo}</Text>
            <Text style={S.docDate}>発行日: {fmtDate(doc.issuedAt)}</Text>
            {doc.validUntil && (
              <Text style={S.docDate}>有効期限: {fmtDate(doc.validUntil)}</Text>
            )}
          </View>
        </View>

        {/* 宛先 */}
        <View style={S.metaRow}>
          <ToBlock label="お見積り先" doc={doc} />
          <OrderMetaBlock doc={doc} />
        </View>

        <Text style={S.greeting}>下記のとおりお見積り申し上げます。</Text>

        {/* 合計ハイライト */}
        <View style={S.totalHighlight}>
          <Text style={S.totalHighlightLabel}>お見積り金額（税込）</Text>
          <Text style={S.totalHighlightAmount}>{yen(doc.totalAmount)}</Text>
        </View>

        {/* 品目テーブル */}
        <LineItemsTable items={doc.lineItems} />

        {/* 小計 */}
        <SubtotalArea d={doc} />

        {/* 備考（振込先なし） */}
        {doc.note && (
          <View>
            <Text style={S.sectionTitle}>備考</Text>
            <Text style={S.sectionText}>{doc.note}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. 請求書
// ─────────────────────────────────────────────────────────────
export function InvoicePDF({ company, doc }: { company: CompanyInfo; doc: DocumentData }) {
  return (
    <Document title={`請求書 ${doc.documentNo}`}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <IssuerBlock c={company} />
          <View style={S.docTitleBlock}>
            <Text style={S.docTitle}>請 求 書</Text>
            <Text style={S.docNo}>No: {doc.documentNo}</Text>
            <Text style={S.docDate}>発行日: {fmtDate(doc.issuedAt)}</Text>
            {doc.paymentDueDate && (
              <Text style={[S.docDate, { color: '#dc2626', fontWeight: 700 }]}>
                お支払期限: {fmtDate(doc.paymentDueDate)}
              </Text>
            )}
          </View>
        </View>

        <View style={S.metaRow}>
          <ToBlock label="請求先" doc={doc} />
          <OrderMetaBlock doc={doc} />
        </View>

        <Text style={S.greeting}>下記のとおりご請求申し上げます。</Text>

        <View style={S.totalHighlight}>
          <Text style={S.totalHighlightLabel}>ご請求金額（税込）</Text>
          <Text style={S.totalHighlightAmount}>{yen(doc.totalAmount)}</Text>
        </View>

        <LineItemsTable items={doc.lineItems} />
        <SubtotalArea d={doc} />
        <BankInfo c={company} />

        {doc.note && (
          <View>
            <Text style={S.sectionTitle}>備考</Text>
            <Text style={S.sectionText}>{doc.note}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. 納品書
// ─────────────────────────────────────────────────────────────
export function DeliveryPDF({ company, doc }: { company: CompanyInfo; doc: DocumentData }) {
  return (
    <Document title={`納品書 ${doc.documentNo}`}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <IssuerBlock c={company} />
          <View style={S.docTitleBlock}>
            <Text style={S.docTitle}>納 品 書</Text>
            <Text style={S.docNo}>No: {doc.documentNo}</Text>
            <Text style={S.docDate}>納品日: {fmtDate(doc.issuedAt)}</Text>
          </View>
        </View>

        <View style={S.metaRow}>
          <ToBlock label="納品先" doc={doc} />
          <OrderMetaBlock doc={doc} />
        </View>

        <Text style={S.greeting}>下記のとおり納品いたします。</Text>
        <LineItemsTable items={doc.lineItems} />
        <SubtotalArea d={doc} />

        {doc.note && (
          <View>
            <Text style={S.sectionTitle}>備考</Text>
            <Text style={S.sectionText}>{doc.note}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. 領収書
// ─────────────────────────────────────────────────────────────
export function ReceiptPDF({ company, doc }: { company: CompanyInfo; doc: DocumentData }) {
  return (
    <Document title={`領収書 ${doc.documentNo}`}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <IssuerBlock c={company} />
          <View style={S.docTitleBlock}>
            <Text style={S.docTitle}>領 収 書</Text>
            <Text style={S.docNo}>No: {doc.documentNo}</Text>
            <Text style={S.docDate}>発行日: {fmtDate(doc.issuedAt)}</Text>
          </View>
        </View>

        {/* 宛先 */}
        <View style={{ marginBottom: 12 }}>
          <Text style={S.toLabel}>宛先</Text>
          <Text style={S.toName}>{doc.customerName}　様</Text>
          {doc.customerPostalCode && (
            <Text style={S.toAddress}>〒{doc.customerPostalCode}</Text>
          )}
          {doc.customerAddress && (
            <Text style={S.toAddress}>{doc.customerAddress}</Text>
          )}
          {doc.contactDepartment && <Text style={S.toContact}>{doc.contactDepartment}</Text>}
          {doc.contactName && <Text style={S.toContact}>{doc.contactName}　様</Text>}
        </View>

        {/* 金額（中央大きく） */}
        <View style={S.receiptCenter}>
          <Text style={{ fontSize: 9, color: '#334155', marginBottom: 4 }}>下記金額を領収いたしました</Text>
          <Text style={S.receiptAmount}>{yen(doc.totalAmount)}</Text>
          <View style={S.stamp}>
            <Text style={S.stampText}>領収</Text>
            <Text style={[S.stampText, { fontSize: 7 }]}>済</Text>
          </View>
        </View>

        {/* 内訳 */}
        <View style={{ marginTop: 12 }}>
          <View style={S.subtotalRow}>
            <Text style={S.subtotalLabel}>内　税額（{Math.round(doc.taxRate * 100)}%）</Text>
            <Text style={S.subtotalValue}>{yen(doc.taxAmount)}</Text>
          </View>
          {doc.receivedMethod && (
            <View style={S.subtotalRow}>
              <Text style={S.subtotalLabel}>お支払い方法</Text>
              <Text style={S.subtotalValue}>{doc.receivedMethod}</Text>
            </View>
          )}
          {doc.receivedAt && (
            <View style={S.subtotalRow}>
              <Text style={S.subtotalLabel}>入金日</Text>
              <Text style={S.subtotalValue}>{fmtDate(doc.receivedAt)}</Text>
            </View>
          )}
          <View style={S.subtotalRow}>
            <Text style={S.subtotalLabel}>件名</Text>
            <Text style={S.subtotalValue}>{doc.orderTitle ?? doc.orderNo}</Text>
          </View>
        </View>

        {/* 内訳品目 */}
        <LineItemsTable items={doc.lineItems} />

        {/* 備考 */}
        {doc.note && (
          <View>
            <Text style={S.sectionTitle}>備考</Text>
            <Text style={S.sectionText}>{doc.note}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
