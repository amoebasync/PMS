/**
 * lib/formatters.ts のユニットテスト
 *
 * テスト対象:
 * - toHalfWidth(): 全角→半角変換
 * - formatPhoneNumber(): 電話番号フォーマット
 * - handlePhoneChange(): 電話番号入力ハンドラ
 */
import { describe, it, expect, vi } from 'vitest';
import { toHalfWidth, formatPhoneNumber, handlePhoneChange } from '@/lib/formatters';

// ----------------------------------------------------------------
// toHalfWidth
// ----------------------------------------------------------------
describe('toHalfWidth()', () => {
  it('全角数字を半角に変換する', () => {
    expect(toHalfWidth('０１２３４５６７８９')).toBe('0123456789');
  });

  it('全角英大文字を半角に変換する', () => {
    expect(toHalfWidth('ＡＢＣＤ')).toBe('ABCD');
  });

  it('全角英小文字を半角に変換する', () => {
    expect(toHalfWidth('ａｂｃｄ')).toBe('abcd');
  });

  it('全角ハイフンを半角に変換する（郵便番号）', () => {
    expect(toHalfWidth('１６０－００２２')).toBe('160-0022');
  });

  it('全角電話番号を半角に変換する', () => {
    expect(toHalfWidth('０９０１２３４５６７８')).toBe('09012345678');
  });

  it('全角スペースを半角スペースに変換する', () => {
    expect(toHalfWidth('山田　太郎')).toBe('山田 太郎');
  });

  it('すでに半角の文字はそのままにする', () => {
    expect(toHalfWidth('abc123')).toBe('abc123');
    expect(toHalfWidth('090-1234-5678')).toBe('090-1234-5678');
  });

  it('日本語（ひらがな・カタカナ・漢字）はそのまま保持する', () => {
    expect(toHalfWidth('東京都新宿区')).toBe('東京都新宿区');
    expect(toHalfWidth('テスト')).toBe('テスト');
    expect(toHalfWidth('てすと')).toBe('てすと');
  });

  it('空文字を渡した場合は空文字を返す', () => {
    expect(toHalfWidth('')).toBe('');
  });

  it('混在した文字列を変換する', () => {
    expect(toHalfWidth('〒１６０－００２２')).toBe('〒160-0022');
  });
});

// ----------------------------------------------------------------
// formatPhoneNumber
// ----------------------------------------------------------------
describe('formatPhoneNumber()', () => {
  it('空文字を渡した場合は空文字を返す', () => {
    expect(formatPhoneNumber('')).toBe('');
  });

  describe('11桁（携帯電話・フリーダイヤル）', () => {
    it('070系携帯電話をフォーマットする', () => {
      expect(formatPhoneNumber('07012345678')).toBe('070-1234-5678');
    });

    it('080系携帯電話をフォーマットする', () => {
      expect(formatPhoneNumber('08012345678')).toBe('080-1234-5678');
    });

    it('090系携帯電話をフォーマットする', () => {
      expect(formatPhoneNumber('09012345678')).toBe('090-1234-5678');
    });

    it('0120フリーダイヤルをフォーマットする', () => {
      expect(formatPhoneNumber('01201234567')).toBe('012-0123-4567');
    });
  });

  describe('10桁（固定電話）', () => {
    it('東京（03）をフォーマットする: XX-XXXX-XXXX', () => {
      expect(formatPhoneNumber('0312345678')).toBe('03-1234-5678');
    });

    it('大阪（06）をフォーマットする: XX-XXXX-XXXX', () => {
      expect(formatPhoneNumber('0612345678')).toBe('06-1234-5678');
    });

    it('その他の地域（045）をフォーマットする: XXX-XXX-XXXX', () => {
      expect(formatPhoneNumber('0451234567')).toBe('045-123-4567');
    });

    it('その他の地域（044）をフォーマットする: XXX-XXX-XXXX', () => {
      expect(formatPhoneNumber('0441234567')).toBe('044-123-4567');
    });
  });

  describe('入力途中（段階的フォーマット）', () => {
    it('1〜3桁: ハイフンなし', () => {
      expect(formatPhoneNumber('0')).toBe('0');
      expect(formatPhoneNumber('09')).toBe('09');
      expect(formatPhoneNumber('090')).toBe('090');
    });

    it('4〜7桁: XXX-XXXX', () => {
      expect(formatPhoneNumber('0901')).toBe('090-1');
      expect(formatPhoneNumber('09012')).toBe('090-12');
      expect(formatPhoneNumber('0901234')).toBe('090-1234');
    });

    it('8〜10桁: XXX-XXXX-XX', () => {
      expect(formatPhoneNumber('09012345')).toBe('090-1234-5');
      expect(formatPhoneNumber('090123456')).toBe('090-1234-56');
    });
  });
});

// ----------------------------------------------------------------
// handlePhoneChange
// ----------------------------------------------------------------
describe('handlePhoneChange()', () => {
  it('全角数字入力を半角に変換してフォーマットする', () => {
    const setPhone = vi.fn();
    handlePhoneChange('０９０１２３４５６７８', setPhone);
    expect(setPhone).toHaveBeenCalledWith('090-1234-5678');
  });

  it('ハイフン付き入力からハイフンを除去してフォーマットする', () => {
    const setPhone = vi.fn();
    handlePhoneChange('090-1234-5678', setPhone);
    expect(setPhone).toHaveBeenCalledWith('090-1234-5678');
  });

  it('11桁を超えた入力は11桁に切り詰める', () => {
    const setPhone = vi.fn();
    handlePhoneChange('090123456789999', setPhone);
    expect(setPhone).toHaveBeenCalledWith('090-1234-5678');
  });

  it('空文字を渡した場合は空文字を設定する', () => {
    const setPhone = vi.fn();
    handlePhoneChange('', setPhone);
    expect(setPhone).toHaveBeenCalledWith('');
  });
});
