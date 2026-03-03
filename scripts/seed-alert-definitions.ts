import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== アラート定義シード開始 ===');

  // カテゴリ取得（名前で検索）
  const adminCategory = await prisma.alertCategory.findFirst({ where: { name: 'アドミン' } });
  const distributorCategory = await prisma.alertCategory.findFirst({ where: { name: '配布員' } });

  if (!adminCategory) {
    console.log('⚠️ アラートカテゴリ「アドミン」が見つかりません。先に /settings でアラートカテゴリを作成してください。');
    console.log('  → 代わりに最初のアクティブなカテゴリを使用します。');
  }
  if (!distributorCategory) {
    console.log('⚠️ アラートカテゴリ「配布員」が見つかりません。先に /settings でアラートカテゴリを作成してください。');
    console.log('  → 代わりに最初のアクティブなカテゴリを使用します。');
  }

  const fallbackCategory = await prisma.alertCategory.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  if (!fallbackCategory && !adminCategory && !distributorCategory) {
    console.error('❌ アクティブなアラートカテゴリが1つもありません。先にカテゴリを作成してください。');
    return;
  }

  // HR_ADMIN ロールのIDを取得
  const hrAdminRole = await prisma.role.findFirst({ where: { code: 'HR_ADMIN' } });

  const definitions = [
    {
      code: 'PENDING_APPROVALS',
      name: '承認処理未対応',
      description: '前週の未承認勤怠・経費をチェックし、残っていればアラートを生成します。',
      categoryId: (adminCategory || fallbackCategory)!.id,
      severity: 'WARNING' as const,
      frequency: 'WEEKLY' as const,
      targetType: hrAdminRole ? 'ROLE' as const : 'ALL' as const,
      targetIds: hrAdminRole ? JSON.stringify([hrAdminRole.id]) : null,
      notifyEnabled: true,
    },
    {
      code: 'RESIDENCE_CARD_MISMATCH',
      name: '在留カード不一致',
      description: '配布員の在留カードAI検証でDB情報と不一致が検出された場合にアラートを生成します（イベント駆動型）。',
      categoryId: (distributorCategory || fallbackCategory)!.id,
      severity: 'WARNING' as const,
      frequency: 'DAILY' as const,
      targetType: 'ALL' as const,
      targetIds: null,
      notifyEnabled: true,
    },
  ];

  for (const def of definitions) {
    const existing = await prisma.alertDefinition.findUnique({ where: { code: def.code } });
    if (existing) {
      console.log(`⏭️  ${def.code} は既に存在します（スキップ）`);
      continue;
    }

    await prisma.alertDefinition.create({ data: def });
    console.log(`✅ ${def.code} (${def.name}) を作成しました`);
  }

  console.log('=== アラート定義シード完了 ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
