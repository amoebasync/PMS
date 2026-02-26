// 帳票PDF生成・ストリーミングダウンロード
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { calcLineItems } from '@/lib/pdf/calculator';
import { EstimatePDF, InvoicePDF, DeliveryPDF, ReceiptPDF } from '@/lib/pdf/template';
import type { CompanyInfo, DocumentData } from '@/lib/pdf/types';

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CREDIT_CARD:  'クレジットカード',
  BANK_TRANSFER: '銀行振込',
  INVOICE:      '請求書払い',
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const docId = parseInt(id);

    // 帳票レコードと関連受注データを取得
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: {
        order: {
          include: {
            customer: {
              include: {
                contacts: { where: { isBillingContact: true }, take: 1 },
              },
            },
            contacts: { include: { customerContact: true }, take: 1 },
            distributions: { include: { flyer: true } },
            printings:      { include: { flyer: true } },
            newspaperInserts: true,
            designs: true,
            payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 自社情報
    const setting = await prisma.companySetting.findFirst({ orderBy: { id: 'asc' } });
    const company: CompanyInfo = setting
      ? {
          companyName:               setting.companyName,
          companyNameKana:           setting.companyNameKana,
          postalCode:                setting.postalCode,
          address:                   setting.address,
          phone:                     setting.phone,
          fax:                       setting.fax,
          email:                     setting.email,
          invoiceRegistrationNumber: setting.invoiceRegistrationNumber,
          bankName:                  setting.bankName,
          bankBranch:                setting.bankBranch,
          bankAccountType:           setting.bankAccountType,
          bankAccountNumber:         setting.bankAccountNumber,
          bankAccountHolder:         setting.bankAccountHolder,
        }
      : { companyName: '（自社情報未設定）' };

    const order  = doc.order;
    const cust   = order.customer;

    // 請求先担当者: billing contact > order contact > 最初のcontact
    const billingContact = cust.contacts[0] ?? order.contacts[0]?.customerContact ?? null;
    const lastPay = order.payments[0] ?? null;

    // 品目・金額計算
    const { lineItems, subtotal, taxAmount, totalAmount } = calcLineItems(order);

    // 支払期限計算（締め日・支払いサイトから算出）
    let paymentDueDate: Date | null = null;
    if (doc.documentType === 'INVOICE' && cust.billingCutoffDay && cust.paymentMonthDelay != null && cust.paymentDay) {
      const now    = new Date(doc.issuedAt);
      const cutoff = cust.billingCutoffDay;
      // 締め日を超えているか
      const baseMonth = now.getDate() > cutoff
        ? new Date(now.getFullYear(), now.getMonth() + 1, cutoff)
        : new Date(now.getFullYear(), now.getMonth(), cutoff);
      // 支払いサイト後の月の支払い日
      paymentDueDate = new Date(
        baseMonth.getFullYear(),
        baseMonth.getMonth() + (cust.paymentMonthDelay ?? 1),
        cust.paymentDay,
      );
    }

    const docData: DocumentData = {
      documentNo:         doc.documentNo,
      issuedAt:           doc.issuedAt,
      customerName:       cust.name ?? cust.customerCode,
      customerPostalCode: cust.postalCode ?? null,
      customerAddress:    cust.address ?? null,
      contactName:        billingContact ? `${billingContact.lastName} ${billingContact.firstName}` : null,
      contactDepartment:  billingContact?.department ?? null,
      orderNo:            order.orderNo,
      orderTitle:         order.title ?? null,
      lineItems:          lineItems.length > 0 ? lineItems : [
        { description: 'ポスティング・印刷サービス一式', quantity: 1, unitPrice: subtotal, amount: subtotal, unit: '式' },
      ],
      subtotal,
      taxAmount,
      totalAmount,
      taxRate:            0.1,
      note:               doc.note ?? null,
      // 見積書
      validUntil:         doc.documentType === 'ESTIMATE'
        ? new Date(doc.issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null,
      // 請求書
      paymentDueDate,
      // 領収書
      receivedAt:         lastPay?.paidAt ?? null,
      receivedMethod:     lastPay?.method ? (PAYMENT_METHOD_LABEL[lastPay.method] ?? lastPay.method) : null,
    };

    // PDF生成
    let element: React.ReactElement;
    switch (doc.documentType) {
      case 'ESTIMATE': element = React.createElement(EstimatePDF,  { company, doc: docData }); break;
      case 'INVOICE':  element = React.createElement(InvoicePDF,   { company, doc: docData }); break;
      case 'DELIVERY': element = React.createElement(DeliveryPDF,  { company, doc: docData }); break;
      case 'RECEIPT':  element = React.createElement(ReceiptPDF,   { company, doc: docData }); break;
      default:         return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    const stream = await renderToStream(element);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    const filename = encodeURIComponent(`${doc.documentNo}.pdf`);
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Content-Length':      String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
