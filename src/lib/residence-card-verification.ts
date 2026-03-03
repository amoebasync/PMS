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

export async function verifyResidenceCard(distributorId: number): Promise<VerificationResult> {
  const distributor = await prisma.flyerDistributor.findUnique({
    where: { id: distributorId },
    include: { country: true, visaType: true },
  });

  if (!distributor) throw new Error('Distributor not found');
  if (!distributor.residenceCardFrontUrl) throw new Error('No residence card front image');

  const frontKey = extractS3Key(distributor.residenceCardFrontUrl);
  if (!frontKey) throw new Error('Invalid front image URL');

  const frontImage = await fetchImageAsBase64(frontKey);

  let backImage: { base64: string; mimeType: string } | undefined;
  if (distributor.residenceCardBackUrl) {
    const backKey = extractS3Key(distributor.residenceCardBackUrl);
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

  const nameComp = compareNames(extracted.name, distributor.name);
  const nationalityComp = compareNationality(extracted.nationality, distributor.country);
  const visaComp = compareVisaType(extracted.visaType, distributor.visaType);
  const expiryComp = compareExpiryDate(extracted.expiryDate, distributor.visaExpiryDate);

  const overallMatch = nameComp.match && nationalityComp.match && visaComp.match && expiryComp.match;

  return {
    extracted,
    comparisons: {
      name: { match: nameComp.match, cardValue: extracted.name, dbValue: distributor.name, confidence: nameComp.confidence },
      nationality: {
        match: nationalityComp.match,
        cardValue: extracted.nationality,
        dbValue: distributor.country?.nameEn || distributor.country?.name || null,
        confidence: nationalityComp.confidence,
      },
      visaType: {
        match: visaComp.match,
        cardValue: extracted.visaType,
        dbValue: distributor.visaType?.name || null,
        confidence: visaComp.confidence,
      },
      expiryDate: {
        match: expiryComp.match,
        cardValue: extracted.expiryDate,
        dbValue: distributor.visaExpiryDate?.toISOString().slice(0, 10) || null,
        confidence: expiryComp.confidence,
      },
    },
    overallMatch,
    processedAt: new Date().toISOString(),
    model: 'gemini-2.5-flash',
  };
}

export async function triggerAutoVerification(distributorId: number): Promise<void> {
  try {
    if (!isGeminiConfigured()) return;

    // Check system setting
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'residenceCardAiVerification' },
    });
    if (setting?.value !== 'true') return;

    // Set PENDING
    await prisma.flyerDistributor.update({
      where: { id: distributorId },
      data: { residenceCardVerificationStatus: 'PENDING' },
    });

    const result = await verifyResidenceCard(distributorId);

    await prisma.flyerDistributor.update({
      where: { id: distributorId },
      data: {
        residenceCardVerificationStatus: result.overallMatch ? 'VERIFIED' : 'MISMATCH',
        residenceCardVerificationResult: result as any,
        residenceCardVerifiedAt: new Date(),
      },
    });

    // MISMATCH の場合はアラートを生成
    if (!result.overallMatch) {
      try {
        const category = await prisma.alertCategory.findFirst({ where: { name: '配布員' } });
        if (category) {
          const dist = await prisma.flyerDistributor.findUnique({
            where: { id: distributorId },
            select: { name: true, staffId: true },
          });
          const staffLabel = dist?.staffId ? `[${dist.staffId}]` : '';
          await createAlert({
            categoryId: category.id,
            severity: 'WARNING',
            title: `在留カード不一致: ${staffLabel}${dist?.name || ''}`,
            message: `AI検証の結果、在留カード情報とDB登録情報に不一致が検出されました。`,
            entityType: 'FlyerDistributor',
            entityId: distributorId,
          });
        }
      } catch (alertError) {
        console.error('[ResidenceCardVerification] Failed to create alert:', alertError);
      }
    }
  } catch (error) {
    console.error('[ResidenceCardVerification] Auto verification error:', error);
    try {
      await prisma.flyerDistributor.update({
        where: { id: distributorId },
        data: {
          residenceCardVerificationStatus: 'ERROR',
          residenceCardVerificationResult: {
            error: error instanceof Error ? error.message : String(error),
            processedAt: new Date().toISOString(),
          },
          residenceCardVerifiedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error('[ResidenceCardVerification] Failed to save error status:', dbError);
    }
  }
}
