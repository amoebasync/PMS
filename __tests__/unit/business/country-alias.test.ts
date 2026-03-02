/**
 * 国名エイリアス検索ロジックのテスト
 *
 * 仕様（/apply の国選択 SearchableSelect）:
 * 1. country.name (日本語名) に部分一致
 * 2. country.nameEn (英語名) に部分一致
 * 3. country.aliases（カンマ区切り別名）の各要素に部分一致
 *
 * 参照: CLAUDE.md「国名エイリアス機能」
 */
import { describe, it, expect } from 'vitest';

interface Country {
  id: number;
  name: string;
  nameEn: string;
  aliases?: string | null;
}

// SearchableSelect の filterFn と同じロジック
function filterCountry(country: Country, search: string): boolean {
  const s = search.trim().toLowerCase();
  if (!s) return true;

  if (country.name.toLowerCase().includes(s)) return true;
  if (country.nameEn?.toLowerCase().includes(s)) return true;
  if (country.aliases) {
    return country.aliases.split(',').some((alias) =>
      alias.trim().toLowerCase().includes(s)
    );
  }
  return false;
}

const testCountries: Country[] = [
  {
    id: 1,
    name: '日本',
    nameEn: 'Japan',
    aliases: '日本国,Nippon,JP',
  },
  {
    id: 2,
    name: '韓国',
    nameEn: 'South Korea',
    aliases: '大韓民国,Republic of Korea,Korea',
  },
  {
    id: 3,
    name: 'アメリカ合衆国',
    nameEn: 'United States',
    aliases: 'アメリカ,米国,USA,US,America',
  },
  {
    id: 4,
    name: '中国',
    nameEn: 'China',
    aliases: '中華人民共和国,People\'s Republic of China,PRC',
  },
  {
    id: 5,
    name: 'フィリピン',
    nameEn: 'Philippines',
    aliases: null, // エイリアスなし
  },
];

describe('国名エイリアス検索（filterCountry）', () => {
  describe('日本語名（name）による検索', () => {
    it('"日本" で日本を検索できる', () => {
      expect(filterCountry(testCountries[0], '日本')).toBe(true);
    });

    it('"韓国" で韓国を検索できる', () => {
      expect(filterCountry(testCountries[1], '韓国')).toBe(true);
    });

    it('"中国" で中国を検索できる', () => {
      expect(filterCountry(testCountries[3], '中国')).toBe(true);
    });

    it('部分一致で検索できる（"アメリカ" → "アメリカ合衆国"）', () => {
      expect(filterCountry(testCountries[2], 'アメリカ')).toBe(true);
    });
  });

  describe('英語名（nameEn）による検索', () => {
    it('"Japan" で日本を検索できる', () => {
      expect(filterCountry(testCountries[0], 'Japan')).toBe(true);
    });

    it('"korea" で韓国を検索できる（大文字小文字無視）', () => {
      expect(filterCountry(testCountries[1], 'korea')).toBe(true);
    });

    it('"united" で米国を部分一致検索できる', () => {
      expect(filterCountry(testCountries[2], 'united')).toBe(true);
    });

    it('"china" で中国を検索できる', () => {
      expect(filterCountry(testCountries[3], 'china')).toBe(true);
    });
  });

  describe('エイリアスによる検索', () => {
    it('"大韓民国" で韓国を検索できる（日本語エイリアス）', () => {
      expect(filterCountry(testCountries[1], '大韓民国')).toBe(true);
    });

    it('"Republic of Korea" で韓国を検索できる（英語エイリアス）', () => {
      expect(filterCountry(testCountries[1], 'Republic of Korea')).toBe(true);
    });

    it('"Korea" で韓国を検索できる（エイリアス部分一致）', () => {
      expect(filterCountry(testCountries[1], 'Korea')).toBe(true);
    });

    it('"USA" でアメリカを検索できる', () => {
      expect(filterCountry(testCountries[2], 'USA')).toBe(true);
    });

    it('"米国" でアメリカを検索できる', () => {
      expect(filterCountry(testCountries[2], '米国')).toBe(true);
    });

    it('"Nippon" で日本を検索できる', () => {
      expect(filterCountry(testCountries[0], 'Nippon')).toBe(true);
    });
  });

  describe('マッチしない検索', () => {
    it('"xyz" はどの国にもマッチしない', () => {
      const results = testCountries.filter((c) => filterCountry(c, 'xyz'));
      expect(results).toHaveLength(0);
    });

    it('"日本" は韓国にマッチしない', () => {
      expect(filterCountry(testCountries[1], '日本')).toBe(false);
    });

    it('エイリアスが null の国（フィリピン）はエイリアス検索でマッチしない', () => {
      expect(filterCountry(testCountries[4], 'Filipino')).toBe(false);
    });
  });

  describe('空文字・エッジケース', () => {
    it('空文字は全件マッチする', () => {
      const results = testCountries.filter((c) => filterCountry(c, ''));
      expect(results).toHaveLength(testCountries.length);
    });

    it('スペースのみは全件マッチする', () => {
      const results = testCountries.filter((c) => filterCountry(c, '   '));
      expect(results).toHaveLength(testCountries.length);
    });

    it('大文字小文字を区別しない（"japan" → 日本）', () => {
      expect(filterCountry(testCountries[0], 'japan')).toBe(true);
    });

    it('大文字小文字を区別しない（"JAPAN" → 日本）', () => {
      expect(filterCountry(testCountries[0], 'JAPAN')).toBe(true);
    });
  });

  describe('複数国への検索', () => {
    it('"Republic" で該当する国を絞り込める', () => {
      const results = testCountries.filter((c) => filterCountry(c, 'Republic'));
      // 韓国（Republic of Korea）と中国（People's Republic of China）
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
