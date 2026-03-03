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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
