/**
 * ビザ種別の英語名・就労制限情報を一括登録するシードスクリプト
 * 実行: npx tsx scripts/seed-visa-types.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const visaData: {
  name: string;
  nameEn: string;
  canContract: boolean;   // 業務委託可否
  canPartTime: boolean;   // アルバイト・パート可否
  workHourLimit: number | null; // 就労制限時間(null=なし, 28=週28時間)
  requiresDesignation: boolean; // 指定書要確認
}[] = [
  {
    name: '永住者',
    nameEn: 'Permanent Resident',
    canContract: true,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '特別永住者',
    nameEn: 'Special Permanent Resident',
    canContract: true,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '日本人の配偶者等',
    nameEn: 'Spouse of Japanese National',
    canContract: true,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '永住者の配偶者等',
    nameEn: 'Spouse of Permanent Resident',
    canContract: true,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '定住者',
    nameEn: 'Long-term Resident',
    canContract: true,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '家族滞在',
    nameEn: 'Dependent',
    canContract: false,
    canPartTime: true,
    workHourLimit: 28,
    requiresDesignation: false,
  },
  {
    name: '技術・人文知識・国際業務',
    nameEn: 'Engineer / Specialist in Humanities / International Services',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '特定技能1号',
    nameEn: 'Specified Skilled Worker Type 1',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '特定技能2号',
    nameEn: 'Specified Skilled Worker Type 2',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '高度専門職1号',
    nameEn: 'Highly Skilled Professional Type 1',
    canContract: true,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '高度専門職2号',
    nameEn: 'Highly Skilled Professional Type 2',
    canContract: true,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '経営・管理',
    nameEn: 'Business Management',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '技能',
    nameEn: 'Skilled Labor',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '介護',
    nameEn: 'Nursing Care',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '医療',
    nameEn: 'Medical Services',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '技能実習1号',
    nameEn: 'Technical Intern Training Type 1',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '技能実習2号',
    nameEn: 'Technical Intern Training Type 2',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '技能実習3号',
    nameEn: 'Technical Intern Training Type 3',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '特定活動（ワーキングホリデー）',
    nameEn: 'Specified Activities (Working Holiday)',
    canContract: false,
    canPartTime: true,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '特定活動（その他）',
    nameEn: 'Specified Activities (Other)',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: true,
  },
  {
    name: '留学',
    nameEn: 'Student',
    canContract: false,
    canPartTime: true,
    workHourLimit: 28,
    requiresDesignation: false,
  },
  {
    name: '短期滞在',
    nameEn: 'Temporary Visitor',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: '文化活動',
    nameEn: 'Cultural Activities',
    canContract: false,
    canPartTime: false,
    workHourLimit: null,
    requiresDesignation: false,
  },
  {
    name: 'J-FND（日本語教育機関）',
    nameEn: 'Japanese Language Education Institution (J-FND)',
    canContract: false,
    canPartTime: true,
    workHourLimit: 28,
    requiresDesignation: false,
  },
];

async function main() {
  console.log('ビザ種別データを更新中...');

  let updated = 0;
  let notFound = 0;

  for (const data of visaData) {
    const result = await prisma.visaType.updateMany({
      where: { name: data.name },
      data: {
        nameEn: data.nameEn,
        canContract: data.canContract,
        canPartTime: data.canPartTime,
        workHourLimit: data.workHourLimit,
        requiresDesignation: data.requiresDesignation,
      },
    });

    if (result.count > 0) {
      console.log(`  ✓ ${data.name} → ${data.nameEn}`);
      updated++;
    } else {
      console.warn(`  ✗ Not found: ${data.name}`);
      notFound++;
    }
  }

  console.log(`\n完了: ${updated}件更新, ${notFound}件未発見`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
