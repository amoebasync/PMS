import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

export interface ResidenceCardData {
  name: string | null;
  nationality: string | null;
  visaType: string | null;
  expiryDate: string | null;
  cardNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
}

export interface BankCardData {
  bankName: string | null;
  branchName: string | null;
  branchCode: string | null;
  accountType: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  accountHolderKana: string | null;
  readable: boolean;
  errorReason: string | null;
}

export async function extractBankCardData(
  imageBase64: string,
  imageMime: string
): Promise<BankCardData> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `あなたは日本のキャッシュカード（銀行カード）を解析するAIです。画像を分析し、以下のJSON形式で結果を返してください。

**重要な判定ルール:**
- 画像がブレている、暗すぎる、キャッシュカードではない、文字が読み取れない場合は readable を false にし、errorReason に日本語で理由を記述してください
- 読み取り可能な場合は readable を true にし、各フィールドを埋めてください
- 口座番号は数字のみ（ハイフンや空白は除去）
- 支店番号も数字のみ
- 口座名義のカナは半角カタカナではなく全角カタカナで返してください

JSON形式（マークダウンのコードブロックは不要、生のJSONのみ）:
{
  "bankName": "銀行名（例: 三菱UFJ銀行）",
  "branchName": "支店名（例: 新宿支店）",
  "branchCode": "支店番号（数字のみ、例: 001）",
  "accountType": "口座種別（普通 or 当座）",
  "accountNumber": "口座番号（数字のみ）",
  "accountHolder": "口座名義（漢字）",
  "accountHolderKana": "口座名義（全角カタカナ）",
  "readable": true,
  "errorReason": null
}

読み取り不可の場合:
{
  "bankName": null,
  "branchName": null,
  "branchCode": null,
  "accountType": null,
  "accountNumber": null,
  "accountHolder": null,
  "accountHolderKana": null,
  "readable": false,
  "errorReason": "画像がブレています。もう一度はっきりと撮影してください。"
}`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: imageBase64, mimeType: imageMime } },
  ]);
  const text = result.response.text().trim();

  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      bankName: parsed.bankName ?? null,
      branchName: parsed.branchName ?? null,
      branchCode: parsed.branchCode ?? null,
      accountType: parsed.accountType ?? null,
      accountNumber: parsed.accountNumber ?? null,
      accountHolder: parsed.accountHolder ?? null,
      accountHolderKana: parsed.accountHolderKana ?? null,
      readable: parsed.readable ?? false,
      errorReason: parsed.errorReason ?? null,
    };
  } catch {
    console.error('[Gemini] Failed to parse bank card response:', text);
    throw new Error('Gemini returned invalid JSON');
  }
}

export async function extractResidenceCardData(
  frontBase64: string,
  frontMime: string,
  backBase64?: string,
  backMime?: string
): Promise<ResidenceCardData> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imageParts: { inlineData: { data: string; mimeType: string } }[] = [
    { inlineData: { data: frontBase64, mimeType: frontMime } },
  ];
  if (backBase64 && backMime) {
    imageParts.push({ inlineData: { data: backBase64, mimeType: backMime } });
  }

  const prompt = `You are analyzing a Japanese residence card (在留カード). Extract the following information from the card image(s).

Return ONLY a JSON object with these fields (no markdown, no code blocks, just raw JSON):
{
  "name": "Full name as written on the card (in the original script - katakana, kanji, or romaji)",
  "nationality": "Country name in English (e.g., 'Vietnam', 'China', 'Philippines')",
  "visaType": "Status of residence in Japanese (在留資格) as written on the card (e.g., '技術・人文知識・国際業務', '特定技能1号')",
  "expiryDate": "Expiry date in YYYY-MM-DD format",
  "cardNumber": "Residence card number",
  "dateOfBirth": "Date of birth in YYYY-MM-DD format",
  "address": "Address as written on the card (if visible, usually on the back)"
}

If any field is not visible or unreadable, set it to null.
For nationality, always use the English name of the country.
For visaType, use the exact Japanese text as printed on the card.
For dates, convert to YYYY-MM-DD format.`;

  const result = await model.generateContent([prompt, ...imageParts]);
  const text = result.response.text().trim();

  // Strip potential markdown code block wrapper
  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      name: parsed.name ?? null,
      nationality: parsed.nationality ?? null,
      visaType: parsed.visaType ?? null,
      expiryDate: parsed.expiryDate ?? null,
      cardNumber: parsed.cardNumber ?? null,
      dateOfBirth: parsed.dateOfBirth ?? null,
      address: parsed.address ?? null,
    };
  } catch {
    console.error('[Gemini] Failed to parse response:', text);
    throw new Error('Gemini returned invalid JSON');
  }
}
