// 月次まとめ請求書 PDF 生成
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { BillingStatementPDF } from '@/lib/pdf/billing-template';
import type { CompanyInfo } from '@/lib/pdf/types';
import { calcLineItems } from '@/lib/pdf/calculator';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const stmt = await prisma.billingStatement.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: {
          include: {
            contacts: { where: { isBillingContact: true }, take: 1 },
          },
        },
        items: {
          include: {
            order: {
              include: {
                distributions:    { include: { flyer: true } },
                printings:        { include: { flyer: true } },
                newspaperInserts: true,
                designs:          true,
              },
            },
          },
          orderBy: { orderId: 'asc' },
        },
      },
    });
    if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

    const cust = stmt.customer;
    const billingContact = cust.contacts[0] ?? null;

    // 各受注の金額・明細を計算
    const TAX_RATE = 0.10;
    const orders = stmt.items.map(item => {
      const calc = calcLineItems(item.order);
      const subtotal   = calc.subtotal   || item.subtotal;
      const taxAmount  = calc.taxAmount  || item.taxAmount;
      const totalAmount = calc.totalAmount || item.amount;

      // 明細行（0円除外）
      const lineItems = calc.lineItems
        .filter(li => li.amount > 0)
        .map(li => {
          const liTax   = Math.round(li.amount * TAX_RATE);
          const liTotal = li.amount + liTax;
          return {
            description: li.description,
            quantity:    li.quantity,
            unitPrice:   li.unitPrice,
            amount:      li.amount,
            taxAmount:   liTax,
            totalAmount: liTotal,
            unit:        li.unit,
          };
        });

      return {
        orderNo:   item.order.orderNo,
        title:     item.order.title,
        subtotal,
        taxAmount,
        amount:    totalAmount,
        lineItems,
      };
    });

    const element = React.createElement(BillingStatementPDF, {
      company,
      doc: {
        statementNo:        stmt.statementNo,
        billingMonth:       stmt.billingMonth,
        issuedAt:           stmt.createdAt,
        paymentDueDate:     stmt.paymentDueDate,
        customerName:       cust.name,
        customerPostalCode: cust.postalCode,
        customerAddress:    cust.address,
        contactName:        billingContact
          ? `${billingContact.lastName} ${billingContact.firstName}`
          : null,
        contactDepartment: billingContact?.department ?? null,
        orders,
        subtotal:    stmt.subtotal,
        taxAmount:   stmt.taxAmount,
        totalAmount: stmt.totalAmount,
        note:        stmt.note,
      },
    });

    const stream = await renderToStream(element as any);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);
    const filename = encodeURIComponent(`${stmt.statementNo}.pdf`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Content-Length':      String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Billing PDF error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
