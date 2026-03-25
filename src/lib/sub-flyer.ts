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
 * 顧客コードがサブチラシかどうかを判定
 */
export function isSubFlyer(externalCustomerCode: string | null | undefined, subCodes: string[]): boolean {
  if (!externalCustomerCode || subCodes.length === 0) return false;
  return subCodes.includes(externalCustomerCode.trim());
}
