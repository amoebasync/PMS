import { prisma } from '@/lib/prisma';

let cachedCodes: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1分キャッシュ

/**
 * サブチラシ顧客コード一覧を取得（メモリキャッシュ付き）
 */
export async function getSubFlyerCustomerCodes(): Promise<string[]> {
  const now = Date.now();
  if (cachedCodes && now - cacheTime < CACHE_TTL) return cachedCodes;

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'subFlyerCustomerCodes' },
  });
  try {
    cachedCodes = setting?.value ? JSON.parse(setting.value) : [];
  } catch {
    cachedCodes = [];
  }
  cacheTime = now;
  return cachedCodes!;
}

/**
 * 顧客コード+チラシ名条件でサブチラシかどうかを判定
 *
 * 例外: 01kp0001 はサブ顧客コードだが、チラシ名に「KP」または「求人」が
 * 含まれていない場合はメイン（クライアント案件の買取等）として扱う
 */
// 顧客コード → チラシ名に必須キーワード（いずれか含む場合のみサブ）
const SUB_CODE_NAME_FILTERS: Record<string, string[]> = {
  '01kp0001': ['KP', '求人'],
};

export function isSubFlyer(
  externalCustomerCode: string | null | undefined,
  subCodes: string[],
  flyerName?: string | null,
): boolean {
  if (!externalCustomerCode || subCodes.length === 0) return false;
  const code = externalCustomerCode.trim();
  if (!subCodes.includes(code)) return false;

  // チラシ名条件がある顧客コードの場合、キーワードチェック
  const nameFilters = SUB_CODE_NAME_FILTERS[code];
  if (nameFilters && flyerName) {
    const upper = flyerName.toUpperCase();
    return nameFilters.some(kw => upper.includes(kw.toUpperCase()));
  }
  // チラシ名条件がない顧客コード、またはチラシ名が不明 → サブとして扱う
  return true;
}
