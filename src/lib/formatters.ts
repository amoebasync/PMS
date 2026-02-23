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
  const digits = raw.replace(/[^\d]/g, '').slice(0, 11);
  setPhone(formatPhoneNumber(digits));
}
