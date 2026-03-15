// 帳票生成に必要な型定義

export type CompanyInfo = {
  companyName: string;
  companyNameKana?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  invoiceRegistrationNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  representativeName?: string | null;
  sealImageUrl?: string | null;
};

export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  unit?: string; // 例: "部", "式"
};

export type DocumentData = {
  documentNo: string;
  issuedAt: Date;
  // 宛先
  customerName: string;
  customerPostalCode?: string | null;
  customerAddress?: string | null;
  contactName?: string | null;
  contactDepartment?: string | null;
  // 受注情報
  orderNo: string;
  orderTitle?: string | null;
  // 金額
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  // オプション
  note?: string | null;
  // 見積書: 有効期限
  validUntil?: Date | null;
  // 請求書: 支払期限・振込先
  paymentDueDate?: Date | null;
  // 領収書: 入金日
  receivedAt?: Date | null;
  receivedMethod?: string | null;
};
