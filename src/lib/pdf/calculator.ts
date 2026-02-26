// 受注データから品目明細・金額を計算するロジック

import type { LineItem } from './types';

// 配布方法の表示名
const METHOD_LABEL: Record<string, string> = {
  '軒並み':   '軒並みポスティング',
  '戸建限定': '戸建限定ポスティング',
  'マンション限定': 'マンション限定ポスティング',
};

// 印刷仕様の表示名
function printingDescription(p: {
  paperType?: string | null;
  paperWeight?: string | null;
  colorType?: string | null;
  flyer?: { name?: string | null } | null;
}): string {
  const parts = [
    p.flyer?.name ?? 'チラシ印刷',
    p.paperType,
    p.paperWeight ? `${p.paperWeight}` : null,
    p.colorType,
  ].filter(Boolean);
  return parts.join(' / ');
}

// 折加工の表示名
const FOLDING_LABEL: Record<string, string> = {
  NONE: 'なし',
  TWO_FOLD: '二つ折り',
  Z_FOLD: 'Z折り（三つ折り）',
  C_FOLD: '巻き三つ折り',
  CROSS_FOLD: '十字折り',
  GATEFOLD: '観音折り',
};

export type OrderForCalc = {
  totalAmount?: number | null;
  distributions?: {
    method: string;
    plannedCount: number;
    distributionUnitPrice?: number | null;
    flyer?: { name?: string | null } | null;
  }[];
  printings?: {
    printCount: number;
    printingUnitPrice?: number | null;
    foldingUnitPrice?: number | null;
    foldingOption?: string | null;
    paperType?: string | null;
    paperWeight?: string | null;
    colorType?: string | null;
    flyer?: { name?: string | null } | null;
  }[];
  newspaperInserts?: {
    plannedCount: number;
    newspaperName?: string | null;
  }[];
  designs?: {
    designConcept?: string | null;
  }[];
};

export function calcLineItems(order: OrderForCalc): {
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  const items: LineItem[] = [];

  // 1. 配布費（単価なしでも品目として表示）
  for (const dist of order.distributions ?? []) {
    if (dist.plannedCount) {
      const hasPrice = dist.distributionUnitPrice != null && dist.distributionUnitPrice > 0;
      items.push({
        description: METHOD_LABEL[dist.method] ?? `ポスティング配布（${dist.method}）`,
        quantity:    dist.plannedCount,
        unitPrice:   hasPrice ? dist.distributionUnitPrice! : 0,
        amount:      hasPrice ? Math.round(dist.plannedCount * dist.distributionUnitPrice!) : 0,
        unit:        '部',
      });
    }
  }

  // 2. 印刷費 & 折加工費（単価なしでも品目として表示）
  for (const p of order.printings ?? []) {
    if (p.printCount) {
      const hasPrintPrice = p.printingUnitPrice != null && p.printingUnitPrice > 0;
      items.push({
        description: printingDescription(p),
        quantity:    p.printCount,
        unitPrice:   hasPrintPrice ? p.printingUnitPrice! : 0,
        amount:      hasPrintPrice ? Math.round(p.printCount * p.printingUnitPrice!) : 0,
        unit:        '枚',
      });
    }
    if (p.foldingOption && p.foldingOption !== 'NONE' && p.printCount) {
      const hasFoldPrice = p.foldingUnitPrice != null && p.foldingUnitPrice > 0;
      items.push({
        description: `折加工（${FOLDING_LABEL[p.foldingOption] ?? p.foldingOption}）`,
        quantity:    p.printCount,
        unitPrice:   hasFoldPrice ? p.foldingUnitPrice! : 0,
        amount:      hasFoldPrice ? Math.round(p.printCount * p.foldingUnitPrice!) : 0,
        unit:        '枚',
      });
    }
  }

  // 3. 新聞折込費
  for (const ni of order.newspaperInserts ?? []) {
    if (ni.plannedCount) {
      items.push({
        description: `新聞折込（${ni.newspaperName ?? '新聞'}）`,
        quantity:    ni.plannedCount,
        unitPrice:   0,
        amount:      0,
        unit:        '部',
      });
    }
  }

  // 4. デザイン費（一式）
  for (const d of order.designs ?? []) {
    items.push({
      description: `デザイン制作費${d.designConcept ? `（${d.designConcept.slice(0, 30)}）` : ''}`,
      quantity:    1,
      unitPrice:   0,
      amount:      0,
      unit:        '式',
    });
  }

  const itemsSubtotal = items.reduce((s, i) => s + i.amount, 0);

  // 品目から合計が計算できない場合は totalAmount から逆算（税込と仮定）
  if (itemsSubtotal === 0 && order.totalAmount) {
    const gross  = order.totalAmount;
    const sub    = Math.round(gross / 1.1);
    const taxAmt = gross - sub;

    if (items.length === 0) {
      // 品目が全くない場合のみ「一式」にまとめる
      return {
        lineItems:   [{ description: 'ポスティング・印刷サービス一式', quantity: 1, unitPrice: sub, amount: sub, unit: '式' }],
        subtotal:    sub,
        taxAmount:   taxAmt,
        totalAmount: gross,
      };
    }

    // 品目はあるが単価未設定: 合計は totalAmount から算出、品目はそのまま表示
    return { lineItems: items, subtotal: sub, taxAmount: taxAmt, totalAmount: gross };
  }

  const TAX_RATE    = 0.10;
  const taxAmount   = Math.floor(itemsSubtotal * TAX_RATE);
  const totalAmount = itemsSubtotal + taxAmount;
  return { lineItems: items, subtotal: itemsSubtotal, taxAmount, totalAmount };
}
