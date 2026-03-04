import { prisma } from '@/lib/prisma';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { isGeminiConfigured, extractResidenceCardData, type ResidenceCardData } from '@/lib/gemini';
import { createAlert } from '@/lib/alerts';

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.AWS_S3_BUCKET || '';
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export type VerifiableEntityType = 'FlyerDistributor' | 'Employee';

interface VerifiableEntity {
  name: string;
  staffId: string | null;
  residenceCardFrontUrl: string | null;
  residenceCardBackUrl: string | null;
  country: { name: string; nameEn: string | null; aliases: string | null } | null;
  visaType: { name: string; nameEn: string } | null;
  visaExpiryDate: Date | null;
}

async function fetchVerifiableEntity(type: VerifiableEntityType, id: number): Promise<VerifiableEntity | null> {
  if (type === 'FlyerDistributor') {
    const d = await prisma.flyerDistributor.findUnique({
      where: { id },
      include: { country: true, visaType: true },
    });
    if (!d) return null;
    return {
      name: d.name,
      staffId: d.staffId,
      residenceCardFrontUrl: d.residenceCardFrontUrl,
      residenceCardBackUrl: d.residenceCardBackUrl,
      country: d.country,
      visaType: d.visaType,
      visaExpiryDate: d.visaExpiryDate,
    };
  } else {
    const e = await prisma.employee.findUnique({
      where: { id },
      include: { country: true, visaType: true },
    });
    if (!e) return null;
    return {
      name: `${e.lastNameJa} ${e.firstNameJa}`,
      staffId: e.employeeCode,
      residenceCardFrontUrl: e.residenceCardFrontUrl,
      residenceCardBackUrl: e.residenceCardBackUrl,
      country: e.country,
      visaType: e.visaType,
      visaExpiryDate: e.visaExpiryDate,
    };
  }
}

async function updateVerificationStatus(
  type: VerifiableEntityType,
  id: number,
  data: {
    residenceCardVerificationStatus: string;
    residenceCardVerificationResult?: unknown;
    residenceCardVerifiedAt?: Date;
  }
) {
  if (type === 'FlyerDistributor') {
    await prisma.flyerDistributor.update({ where: { id }, data: data as any });
  } else {
    await prisma.employee.update({ where: { id }, data: data as any });
  }
}

function extractS3Key(url: string): string | null {
  if (!url) return null;
  // Proxy URL: /api/s3-proxy?key=uploads/...
  const proxyMatch = url.match(/[?&]key=([^&]+)/);
  if (proxyMatch) return decodeURIComponent(proxyMatch[1]);
  // Direct S3 URL
  const s3Prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
  if (url.startsWith(s3Prefix)) return url.slice(s3Prefix.length);
  // Already a key
  if (url.startsWith('uploads/')) return url;
  return null;
}

async function fetchImageAsBase64(s3Key: string): Promise<{ base64: string; mimeType: string }> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  const bytes = await response.Body!.transformToByteArray();
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = response.ContentType || 'image/jpeg';
  return { base64, mimeType };
}

function normalizeForComparison(s: string | null | undefined): string {
  if (!s) return '';
  return s.toUpperCase().replace(/[\s\u3000\-\.・,　]/g, '').trim();
}

function compareNames(cardName: string | null, dbName: string | null): { match: boolean; confidence: number } {
  const a = normalizeForComparison(cardName);
  const b = normalizeForComparison(dbName);
  if (!a || !b) return { match: false, confidence: 0 };
  if (a === b) return { match: true, confidence: 1.0 };
  // Partial match - one contains the other
  if (a.includes(b) || b.includes(a)) return { match: true, confidence: 0.8 };
  // Check individual words/tokens
  const aTokens = a.replace(/[A-Z]/g, '$& ').trim().split(/\s+/);
  const bTokens = b.replace(/[A-Z]/g, '$& ').trim().split(/\s+/);
  const matchCount = aTokens.filter(t => bTokens.some(bt => bt.includes(t) || t.includes(bt))).length;
  const ratio = matchCount / Math.max(aTokens.length, bTokens.length);
  if (ratio >= 0.5) return { match: true, confidence: ratio };
  return { match: false, confidence: ratio };
}

function compareNationality(
  cardNationality: string | null,
  country: { name: string; nameEn: string | null; aliases: string | null } | null
): { match: boolean; confidence: number } {
  if (!cardNationality || !country) return { match: false, confidence: 0 };
  const cardVal = normalizeForComparison(cardNationality);
  // Check nameEn
  if (country.nameEn && normalizeForComparison(country.nameEn) === cardVal) return { match: true, confidence: 1.0 };
  // Check name (Japanese)
  if (normalizeForComparison(country.name) === cardVal) return { match: true, confidence: 1.0 };
  // Check aliases
  if (country.aliases) {
    const aliases = country.aliases.split(',').map(a => normalizeForComparison(a));
    if (aliases.some(a => a === cardVal || a.includes(cardVal) || cardVal.includes(a))) {
      return { match: true, confidence: 0.9 };
    }
  }
  // Partial match
  if (country.nameEn && (normalizeForComparison(country.nameEn).includes(cardVal) || cardVal.includes(normalizeForComparison(country.nameEn)))) {
    return { match: true, confidence: 0.7 };
  }
  return { match: false, confidence: 0 };
}

function compareVisaType(
  cardVisaType: string | null,
  visaType: { name: string; nameEn: string } | null
): { match: boolean; confidence: number } {
  if (!cardVisaType || !visaType) return { match: false, confidence: 0 };
  const cardVal = normalizeForComparison(cardVisaType);
  const dbName = normalizeForComparison(visaType.name);
  const dbNameEn = normalizeForComparison(visaType.nameEn);
  if (cardVal === dbName || cardVal === dbNameEn) return { match: true, confidence: 1.0 };
  if (dbName.includes(cardVal) || cardVal.includes(dbName)) return { match: true, confidence: 0.8 };
  if (dbNameEn && (dbNameEn.includes(cardVal) || cardVal.includes(dbNameEn))) return { match: true, confidence: 0.8 };
  return { match: false, confidence: 0 };
}

function compareExpiryDate(cardDate: string | null, dbDate: Date | null): { match: boolean; confidence: number } {
  if (!cardDate || !dbDate) return { match: false, confidence: 0 };
  const dbStr = dbDate.toISOString().slice(0, 10);
  if (cardDate === dbStr) return { match: true, confidence: 1.0 };
  // Try normalizing card date
  const normalized = cardDate.replace(/\//g, '-');
  if (normalized === dbStr) return { match: true, confidence: 1.0 };
  return { match: false, confidence: 0 };
}

export interface VerificationResult {
  extracted: ResidenceCardData;
  comparisons: {
    name: { match: boolean; cardValue: string | null; dbValue: string | null; confidence: number };
    nationality: { match: boolean; cardValue: string | null; dbValue: string | null; confidence: number };
    visaType: { match: boolean; cardValue: string | null; dbValue: string | null; confidence: number };
    expiryDate: { match: boolean; cardValue: string | null; dbValue: string | null; confidence: number };
  };
  overallMatch: boolean;
  processedAt: string;
  model: string;
}

export async function verifyResidenceCard(entityType: VerifiableEntityType, entityId: number): Promise<VerificationResult> {
  const entity = await fetchVerifiableEntity(entityType, entityId);

  if (!entity) throw new Error(`${entityType} not found`);
  if (!entity.residenceCardFrontUrl) throw new Error('No residence card front image');

  const frontKey = extractS3Key(entity.residenceCardFrontUrl);
  if (!frontKey) throw new Error('Invalid front image URL');

  const frontImage = await fetchImageAsBase64(frontKey);

  let backImage: { base64: string; mimeType: string } | undefined;
  if (entity.residenceCardBackUrl) {
    const backKey = extractS3Key(entity.residenceCardBackUrl);
    if (backKey) {
      backImage = await fetchImageAsBase64(backKey);
    }
  }

  const extracted = await extractResidenceCardData(
    frontImage.base64,
    frontImage.mimeType,
    backImage?.base64,
    backImage?.mimeType
  );

  const nameComp = compareNames(extracted.name, entity.name);
  const nationalityComp = compareNationality(extracted.nationality, entity.country);
  const visaComp = compareVisaType(extracted.visaType, entity.visaType);
  const expiryComp = compareExpiryDate(extracted.expiryDate, entity.visaExpiryDate);

  const overallMatch = nameComp.match && nationalityComp.match && visaComp.match && expiryComp.match;

  return {
    extracted,
    comparisons: {
      name: { match: nameComp.match, cardValue: extracted.name, dbValue: entity.name, confidence: nameComp.confidence },
      nationality: {
        match: nationalityComp.match,
        cardValue: extracted.nationality,
        dbValue: entity.country?.nameEn || entity.country?.name || null,
        confidence: nationalityComp.confidence,
      },
      visaType: {
        match: visaComp.match,
        cardValue: extracted.visaType,
        dbValue: entity.visaType?.name || null,
        confidence: visaComp.confidence,
      },
      expiryDate: {
        match: expiryComp.match,
        cardValue: extracted.expiryDate,
        dbValue: entity.visaExpiryDate?.toISOString().slice(0, 10) || null,
        confidence: expiryComp.confidence,
      },
    },
    overallMatch,
    processedAt: new Date().toISOString(),
    model: 'gemini-2.5-flash',
  };
}

export async function triggerAutoVerification(entityType: VerifiableEntityType, entityId: number): Promise<void> {
  try {
    if (!isGeminiConfigured()) return;

    // Check system setting
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'residenceCardAiVerification' },
    });
    if (setting?.value !== 'true') return;

    // Set PENDING
    await updateVerificationStatus(entityType, entityId, {
      residenceCardVerificationStatus: 'PENDING',
    });

    const result = await verifyResidenceCard(entityType, entityId);

    await updateVerificationStatus(entityType, entityId, {
      residenceCardVerificationStatus: result.overallMatch ? 'VERIFIED' : 'MISMATCH',
      residenceCardVerificationResult: result as any,
      residenceCardVerifiedAt: new Date(),
    });

    // MISMATCH の場合はアラートを生成（AlertDefinitionの設定に従う）
    if (!result.overallMatch) {
      try {
        const alertDef = await prisma.alertDefinition.findUnique({
          where: { code: 'RESIDENCE_CARD_MISMATCH' },
        });

        const categoryName = entityType === 'Employee' ? '社員' : '配布員';

        // AlertDefinitionが無効の場合はスキップ
        if (alertDef && alertDef.isEnabled) {
          const entity = await fetchVerifiableEntity(entityType, entityId);
          const staffLabel = entity?.staffId ? `[${entity.staffId}]` : '';
          const title = `在留カード不一致: ${staffLabel}${entity?.name || ''}`;
          const message = `AI検証の結果、在留カード情報とDB登録情報に不一致が検出されました。`;

          await createAlert({
            categoryId: alertDef.categoryId,
            severity: alertDef.severity,
            title,
            message,
            entityType,
            entityId,
          });

          // 通知生成
          if (alertDef.notifyEnabled) {
            const { createAlertNotification } = await import('@/lib/alert-notifications');
            const latestAlert = await prisma.alert.findFirst({
              where: { entityType, entityId, categoryId: alertDef.categoryId, status: 'OPEN' },
              orderBy: { createdAt: 'desc' },
            });
            await createAlertNotification(alertDef, latestAlert?.id ?? null, title, message);
          }
        } else {
          // AlertDefinitionがない場合は従来のフォールバック
          const category = await prisma.alertCategory.findFirst({ where: { name: categoryName } })
            || await prisma.alertCategory.findFirst({ where: { name: '配布員' } });
          if (category) {
            const entity = await fetchVerifiableEntity(entityType, entityId);
            const staffLabel = entity?.staffId ? `[${entity.staffId}]` : '';
            await createAlert({
              categoryId: category.id,
              severity: 'WARNING',
              title: `在留カード不一致: ${staffLabel}${entity?.name || ''}`,
              message: `AI検証の結果、在留カード情報とDB登録情報に不一致が検出されました。`,
              entityType,
              entityId,
            });
          }
        }
      } catch (alertError) {
        console.error('[ResidenceCardVerification] Failed to create alert:', alertError);
      }
    }
  } catch (error) {
    console.error('[ResidenceCardVerification] Auto verification error:', error);
    try {
      await updateVerificationStatus(entityType, entityId, {
        residenceCardVerificationStatus: 'ERROR',
        residenceCardVerificationResult: {
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString(),
        },
        residenceCardVerifiedAt: new Date(),
      });
    } catch (dbError) {
      console.error('[ResidenceCardVerification] Failed to save error status:', dbError);
    }
  }
}
