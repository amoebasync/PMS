/**
 * 全角数字・ハイフン等を半角に変換する
 * 例: ０９０１２３４５６７８ → 09012345678
 *     １６０－００２２ → 160-0022
 */
export function toHalfWidth(str: string): string {
  return str
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
}

/**
 * 郵便番号から住所を取得する
 */
export async function lookupPostalCode(digits: string): Promise<string | null> {
  if (digits.length !== 7) return null;
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
    const data = await res.json();
    if (data.results?.[0]) {
      const r = data.results[0];
      return `${r.address1}${r.address2}${r.address3}`;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * 郵便番号inputのonChange用ハンドラ（全角対応・住所自動補完付き）
 */
export function handlePostalInput(
  raw: string,
  setPostal: (v: string) => void,
  setAddress: (v: string) => void
): void {
  const digits = toHalfWidth(raw).replace(/[^\d]/g, '').slice(0, 7);
  if (digits.length < 7) {
    setPostal(digits.length >= 4 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits);
    return;
  }
  setPostal(`${digits.slice(0, 3)}-${digits.slice(3)}`);
  lookupPostalCode(digits).then((addr) => { if (addr) setAddress(addr); });
}

/**
 * 電話番号を日本の形式にフォーマットする
 * 例: 07021958877 → 070-2195-8877
 *     0312345678  → 03-1234-5678
 *     0612345678  → 06-1234-5678
 */
export function formatPhoneNumber(digits: string): string {
  if (digits.length === 0) return '';

  // 11桁: 携帯・フリーダイヤル等 → XXX-XXXX-XXXX
  if (digits.length >= 11) {
    const d = digits.slice(0, 11);
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  // 10桁: 固定電話
  if (digits.length === 10) {
    // 東京(03)・大阪(06): XX-XXXX-XXXX
    if (digits.startsWith('03') || digits.startsWith('06')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    // その他: XXX-XXX-XXXX
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 入力途中: 段階的にハイフンを挿入
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/**
 * 電話番号inputのonChange用ハンドラ
 */
export function handlePhoneChange(
  raw: string,
  setPhone: (v: string) => void
): void {
  const digits = toHalfWidth(raw).replace(/[^\d]/g, '').slice(0, 11);
  setPhone(formatPhoneNumber(digits));
}
