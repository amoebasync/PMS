/**
 * ポスティングシステム API 共通ユーティリティ
 */

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (PS_API_KEY) headers['X-API-Key'] = PS_API_KEY;
  return headers;
}

export function isPostingSystemConfigured(): boolean {
  return !!PS_API_URL;
}

export async function fetchStaffGps(
  staffId: string,
  targetDate: string,
  options?: { maxPoints?: number }
): Promise<{ lat: number; lng: number; timestamp: string }[]> {
  if (!PS_API_URL) return [];

  const psRes = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
    method: 'POST',
    headers: getHeaders(),
    body: new URLSearchParams({ STAFF_ID: staffId, TARGET_DATE: targetDate }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!psRes.ok) return [];

  const body = await psRes.text();
  let rows: any[];
  try {
    const parsed = JSON.parse(body);
    rows = Array.isArray(parsed) ? parsed : (parsed.data || []);
  } catch {
    return [];
  }

  const gpsPoints = rows
    .filter((r: any) => {
      const lat = parseFloat(r.LATITUDE || '0');
      const lng = parseFloat(r.LONGITUDE || '0');
      return lat !== 0 && lng !== 0;
    })
    .map((r: any) => {
      const terminalTime = (r.TERMINAL_TIME || '').trim();
      const isoTimestamp = terminalTime
        ? `${targetDate}T${terminalTime}+09:00`
        : new Date().toISOString();
      return {
        lat: parseFloat(r.LATITUDE),
        lng: parseFloat(r.LONGITUDE),
        timestamp: isoTimestamp,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const maxPoints = options?.maxPoints ?? 500;
  if (gpsPoints.length > maxPoints) {
    const step = Math.ceil(gpsPoints.length / maxPoints);
    return gpsPoints.filter((_, i) => i % step === 0 || i === gpsPoints.length - 1);
  }

  return gpsPoints;
}

export type AreaHistoryRecord = {
  conditionDate: string;
  manageCode: string;
  staffName: string;
  city: string;
  streetNumber: string;
  totalSheets: number;
  totalPosted: number;
};

export async function fetchAreaHistory(
  streetNumber: string,
  limit: number = 50
): Promise<AreaHistoryRecord[]> {
  if (!PS_API_URL) return [];

  const psRes = await fetch(`${PS_API_URL}/GetAreaHistory.php`, {
    method: 'POST',
    headers: getHeaders(),
    body: new URLSearchParams({ STREET_NUMBER: streetNumber, LIMIT: String(limit) }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!psRes.ok) return [];

  const body = await psRes.text();
  let rows: any[];
  try {
    const parsed = JSON.parse(body);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  return rows.map((r: any) => ({
    conditionDate: r.CONDITION_DATE || '',
    manageCode: r.MANAGE_CODE || '',
    staffName: r.STAFF_NAME || '',
    city: r.CITY || '',
    streetNumber: r.STREET_NUMBER || '',
    totalSheets: parseInt(r.TOTAL_SHEETS) || 0,
    totalPosted: parseInt(r.TOTAL_POSTED) || 0,
  }));
}
