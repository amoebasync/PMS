import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    include: {
      branch:     true,
      department: true,
    },
    orderBy: { id: 'asc' },
  });

  const genderLabel: Record<string, string> = {
    male:    '男性',
    female:  '女性',
    unknown: '不明',
  };

  const rankLabel: Record<string, string> = {
    ASSOCIATE:  'アソシエイト',
    JUNIOR:     'ジュニア',
    MID:        'ミドル',
    SENIOR:     'シニア',
    LEAD:       'リード',
    MANAGER:    'マネージャー',
    DIRECTOR:   'ディレクター',
    EXECUTIVE:  'エグゼクティブ',
  };

  const employmentTypeLabel: Record<string, string> = {
    FULL_TIME: '正社員',
    PART_TIME: 'アルバイト・パート',
    OUTSOURCE: '業務委託',
  };

  const headers = [
    'ID',
    '社員コード',
    '姓（漢字）',
    '名（漢字）',
    '姓（カナ）',
    '名（カナ）',
    '姓（英字）',
    '名（英字）',
    '生年月日',
    '性別',
    'メールアドレス',
    '電話番号',
    '支店',
    '部署',
    '階級',
    '職種',
    '雇用形態',
    '在籍状況',
    '入社日',
    '退職日',
    '登録日',
  ];

  const fmt = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : '';

  const escape = (v: string | null | undefined) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = employees.map(e => [
    e.id,
    escape(e.employeeCode),
    escape(e.lastNameJa),
    escape(e.firstNameJa),
    escape(e.lastNameKana),
    escape(e.firstNameKana),
    escape(e.lastNameEn),
    escape(e.firstNameEn),
    fmt(e.birthday),
    genderLabel[e.gender] ?? e.gender,
    escape(e.email),
    escape(e.phone),
    escape(e.branch?.name),
    escape(e.department?.name),
    rankLabel[e.rank] ?? e.rank,
    escape(e.jobTitle),
    employmentTypeLabel[e.employmentType] ?? e.employmentType,
    e.isActive ? '在籍' : '退職',
    fmt(e.hireDate),
    fmt(e.resignationDate),
    fmt(e.createdAt),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  // BOM付きUTF-8（Excelで文字化けしないように）
  const bom = '\uFEFF';
  const outPath = join(process.cwd(), 'employees_export.csv');
  writeFileSync(outPath, bom + csv, 'utf8');

  console.log(`✅ ${employees.length} 件の社員データを出力しました`);
  console.log(`📄 ファイル: ${outPath}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
