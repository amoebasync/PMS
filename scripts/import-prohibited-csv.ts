/**
 * CSVファイルから禁止物件をDBに一括インポートするスクリプト
 * Usage: npx tsx scripts/import-prohibited-csv.ts <csv-path>
 *
 * CSVカラム:
 * COMPANY_CD, CLIENT_CD, LOCATE_PREF_CD, LOCATE_CITY_CD, TYPE_DIV, DETAIL_NO,
 * FLYER_CD, CENTER_LO, CENTER_LA, POINT_ENCODE, ADDRESS, COMMENT, REMARK,
 * COLOR, BACKGROUND, PLACED_CODE, PLACED_SUB_CODE, DISPLAY_NO, REG_DATE, UPD_DATE, ...
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import polyline from '@mapbox/polyline';

const prisma = new PrismaClient();

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function polylineToGeojson(encoded: string): string | null {
  try {
    const coords = polyline.decode(encoded);
    if (coords.length < 3) return null;
    const ring = coords.map(([lat, lng]: [number, number]) => [lng, lat]);
    if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
      ring.push(ring[0]);
    }
    return JSON.stringify({ type: 'Polygon', coordinates: [ring] });
  } catch {
    return null;
  }
}

async function main() {
  const csvPath = process.argv[2] || '/Users/kuenheekim/Downloads/m_prohibit_building_202602191417.csv';

  console.log(`Reading CSV: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  console.log(`Headers: ${headers.join(', ')}`);
  console.log(`Data rows: ${lines.length - 1}`);

  // Build column index
  const col = (name: string) => headers.indexOf(name);
  const iCompanyCd = col('COMPANY_CD');
  const iClientCd = col('CLIENT_CD');
  const iPrefCd = col('LOCATE_PREF_CD');
  const iCityCd = col('LOCATE_CITY_CD');
  const iLng = col('CENTER_LO');
  const iLat = col('CENTER_LA');
  const iPointEncode = col('POINT_ENCODE');
  const iAddress = col('ADDRESS');
  const iComment = col('COMMENT');
  const iRemark = col('REMARK');
  const iColor = col('COLOR');
  const iBackground = col('BACKGROUND');
  const iPlacedCode = col('PLACED_CODE');
  const iPlacedSubCode = col('PLACED_SUB_CODE');

  // Lookup maps for prefecture/city/area
  // Prefecture.id = 都道府県コード (1-47)
  const prefectures = await prisma.prefecture.findMany({ select: { id: true } });
  const prefMap = new Map(prefectures.map(p => [String(p.id).padStart(2, '0'), p.id]));

  const citiesAll = await prisma.city.findMany({ select: { id: true, code: true } });
  const cityCodeMap = new Map(citiesAll.map(c => [c.code, c.id]));

  const areas = await prisma.area.findMany({ select: { id: true, address_code: true } });
  const areaMap = new Map(areas.map(a => [a.address_code, a.id]));

  // Lookup customers by customerCode
  const customers = await prisma.customer.findMany({ select: { id: true, customerCode: true } });
  const customerMap = new Map(customers.map(c => [c.customerCode, c.id]));

  // Check existing count
  const existingCount = await prisma.prohibitedProperty.count();
  console.log(`Existing prohibited properties in DB: ${existingCount}`);

  if (existingCount > 0) {
    console.log('WARNING: DB already has data. Clearing all existing records...');
    await prisma.prohibitedProperty.deleteMany();
    console.log('Cleared.');
  }

  const BATCH_SIZE = 500;
  let imported = 0;
  let skipped = 0;
  let withPolygon = 0;
  const batch: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 11) { skipped++; continue; }

    const lat = parseFloat(fields[iLat]) || null;
    const lng = parseFloat(fields[iLng]) || null;
    const address = fields[iAddress]?.trim() || '';
    const buildingName = fields[iComment]?.trim() || null;
    const remark = fields[iRemark]?.trim() || null;
    const pointEncode = fields[iPointEncode]?.trim() || '';
    const placedCode = fields[iPlacedCode]?.trim() || '';
    const placedSubCode = fields[iPlacedSubCode]?.trim() || '';
    const clientCd = fields[iClientCd]?.trim() || '';
    const prefCd = fields[iPrefCd]?.trim().padStart(2, '0') || '';
    const cityCd = fields[iCityCd]?.trim() || '';
    const pinColor = fields[iBackground]?.trim() || null;

    if (!address && !lat && !lng) { skipped++; continue; }

    // Resolve area from PLACED_CODE (address_code)
    const addressCode = placedCode || null;
    const areaId = addressCode ? (areaMap.get(addressCode) || null) : null;

    // Resolve prefecture/city
    const prefectureId = prefCd ? (prefMap.get(prefCd) || null) : null;
    // City.code format varies — try both common formats
    let cityId: number | null = null;
    if (prefCd && cityCd) {
      const code5 = `${prefCd}${cityCd.padStart(3, '0')}`;
      cityId = cityCodeMap.get(code5) || null;
      if (!cityId) {
        // Try as-is from CSV
        cityId = cityCodeMap.get(cityCd) || null;
      }
    }

    // Resolve customer (CLIENT_CD = "00000000" means all customers)
    const customerId = (clientCd && clientCd !== '00000000') ? (customerMap.get(clientCd) || null) : null;

    // Polygon
    let boundaryGeojson: string | null = null;
    if (pointEncode && pointEncode.length > 5) {
      boundaryGeojson = polylineToGeojson(pointEncode);
      if (boundaryGeojson) withPolygon++;
    }

    batch.push({
      address,
      buildingName,
      latitude: lat,
      longitude: lng,
      prefectureId,
      cityId,
      areaId,
      customerId,
      boundaryGeojson,
      reasonDetail: remark || null,
      originalCode: placedCode || null,
      externalCustomerCode: clientCd !== '00000000' ? clientCd : null,
      isActive: true,
      importedAt: new Date(),
    });

    if (batch.length >= BATCH_SIZE) {
      await prisma.prohibitedProperty.createMany({ data: batch });
      imported += batch.length;
      batch.length = 0;
      if (imported % 5000 === 0) {
        console.log(`  Progress: ${imported} / ${lines.length - 1}`);
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await prisma.prohibitedProperty.createMany({ data: batch });
    imported += batch.length;
  }

  console.log(`\nDone!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  With polygon: ${withPolygon}`);
  console.log(`  Skipped: ${skipped}`);

  const finalCount = await prisma.prohibitedProperty.count();
  console.log(`  Total in DB: ${finalCount}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
