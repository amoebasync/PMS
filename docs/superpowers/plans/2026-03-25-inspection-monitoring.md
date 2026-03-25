# 配布員チェック・指導モニタリング機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配布員ごとのチェック・指導履歴を一覧で管理し、長期間チェックがない配布員を可視化して不正リスクを低減する

**Architecture:** FlyerDistributorにlastInspectedAt/nextInspectionDueフィールドを追加し、FieldInspection完了時に自動更新。新規ダッシュボードウィジェット＋配布員一覧にチェック状況カラムを追加。チェック周期はシステム設定で管理。

**Tech Stack:** Next.js App Router, Prisma, Tailwind CSS, i18n

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `prisma/schema.prisma` | 修正 | FlyerDistributorにlastInspectedAt, nextInspectionDue追加 |
| `src/app/api/settings/system/route.ts` | 修正 | チェック周期のデフォルト設定追加 |
| `src/app/api/inspections/[id]/finish/route.ts` | 修正 | 完了時にlastInspectedAt/nextInspectionDue自動更新 |
| `src/app/api/distributors/inspection-status/route.ts` | 新規 | チェック状況一覧API |
| `src/app/inspections/monitoring/page.tsx` | 新規 | チェックモニタリング画面 |
| `src/i18n/locales/ja/inspections.json` | 修正 | 翻訳キー追加 |
| `src/i18n/locales/en/inspections.json` | 修正 | 翻訳キー追加 |

---

### Task 1: DBスキーマ変更 — FlyerDistributorにチェック追跡フィールド追加

**Files:**
- Modify: `prisma/schema.prisma` (FlyerDistributor model)

- [ ] **Step 1: スキーマにフィールド追加**

```prisma
// FlyerDistributor model の給与・評価レート情報セクション後に追加
  // チェック・指導追跡
  lastInspectedAt     DateTime? @map("last_inspected_at")          // 最後のチェック/指導日
  lastInspectionType  String?   @map("last_inspection_type") @db.VarChar(20) // CHECK or GUIDANCE
  nextInspectionDue   DateTime? @map("next_inspection_due") @db.Date // 次回チェック予定日
  inspectionInterval  Int?      @map("inspection_interval")        // 個別チェック周期（日）、nullならシステム設定
```

- [ ] **Step 2: DBに反映**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: 既存データのバックフィル — 既にチェック済みの配布員のlastInspectedAtを設定**

```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // 各配布員の最新チェック日を取得して更新
  const distributors = await prisma.flyerDistributor.findMany({ select: { id: true } });
  let updated = 0;
  for (const d of distributors) {
    const latest = await prisma.fieldInspection.findFirst({
      where: { distributorId: d.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, category: true },
    });
    if (latest?.completedAt) {
      await prisma.flyerDistributor.update({
        where: { id: d.id },
        data: { lastInspectedAt: latest.completedAt, lastInspectionType: latest.category },
      });
      updated++;
    }
  }
  console.log('Updated:', updated);
}
main().then(() => prisma.\$disconnect());
"
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: FlyerDistributorにチェック追跡フィールド追加"
```

---

### Task 2: システム設定 — デフォルトチェック周期

**Files:**
- Modify: `src/app/api/settings/system/route.ts`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/i18n/locales/ja/settings.json`
- Modify: `src/i18n/locales/en/settings.json`

- [ ] **Step 1: システム設定にデフォルト値追加**

`src/app/api/settings/system/route.ts` の DEFAULTS に追加:
```typescript
inspectionIntervalDays: '30', // デフォルトチェック周期（日）
```

- [ ] **Step 2: 設定画面にUI追加**

`src/app/settings/page.tsx` の全般設定タブ内（サブチラシ設定の後）に追加:
- 「チェック周期（日）」入力フィールド
- 数値入力 + 保存ボタン
- 説明テキスト: 「配布員のチェック間隔のデフォルト値です。個別設定がない場合この値が使われます。」

- [ ] **Step 3: 翻訳キー追加**

- [ ] **Step 4: Commit**

---

### Task 3: チェック完了時の自動更新

**Files:**
- Modify: `src/app/api/inspections/[id]/finish/route.ts`

- [ ] **Step 1: finish APIにlastInspectedAt/nextInspectionDue更新ロジック追加**

チェック完了時に:
1. `FlyerDistributor.lastInspectedAt` = 現在日時
2. `FlyerDistributor.lastInspectionType` = inspection.category
3. `FlyerDistributor.nextInspectionDue` = 現在日時 + (個別周期 or システム設定周期)

```typescript
// finish処理の後に追加
if (inspection.distributorId) {
  const intervalSetting = await prisma.systemSetting.findUnique({ where: { key: 'inspectionIntervalDays' } });
  const distributor = await prisma.flyerDistributor.findUnique({
    where: { id: inspection.distributorId },
    select: { inspectionInterval: true }
  });
  const intervalDays = distributor?.inspectionInterval || parseInt(intervalSetting?.value || '30');
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + intervalDays);

  await prisma.flyerDistributor.update({
    where: { id: inspection.distributorId },
    data: {
      lastInspectedAt: new Date(),
      lastInspectionType: inspection.category,
      nextInspectionDue: nextDue,
    },
  });
}
```

- [ ] **Step 2: Commit**

---

### Task 4: チェック状況一覧API

**Files:**
- Create: `src/app/api/distributors/inspection-status/route.ts`

- [ ] **Step 1: API実装**

GET `/api/distributors/inspection-status`
- クエリパラメータ: `branchId`, `sort` (overdue|recent|never), `limit`
- 全アクティブ配布員のチェック状況を返す
- レスポンス: 配布員ID, 名前, スタッフID, 支店, 最終チェック日, チェック種別, 次回予定日, 経過日数, ステータス(OVERDUE/DUE_SOON/OK/NEVER)

```typescript
// ステータス判定ロジック
// NEVER: lastInspectedAt === null
// OVERDUE: 今日 > nextInspectionDue
// DUE_SOON: nextInspectionDueまで7日以内
// OK: それ以外
```

- [ ] **Step 2: Commit**

---

### Task 5: チェックモニタリング画面

**Files:**
- Create: `src/app/inspections/monitoring/page.tsx`
- Modify: サイドバー（該当ファイル）にメニュー追加

- [ ] **Step 1: 画面実装**

レイアウト:
- ヘッダー: 「チェック・指導モニタリング」タイトル
- サマリーカード: 期限超過(赤), 間もなく期限(黄), チェック未実施(灰), 正常(緑)
- テーブル: 配布員名, スタッフID, 支店, 最終チェック日, 種別, 次回予定, 経過日数, ステータスバッジ
- フィルタ: 支店, ステータス
- ソート: 期限超過優先（デフォルト）
- 行クリック → 配布員詳細ページ

ステータスバッジ:
- OVERDUE: 赤「期限超過」
- DUE_SOON: 黄「間もなく」
- NEVER: 灰「未実施」
- OK: 緑「正常」

- [ ] **Step 2: サイドバーにメニュー追加**

OPERATIONSグループに「チェックモニタリング」を追加

- [ ] **Step 3: 翻訳キー追加**

- [ ] **Step 4: Commit**

---

### Task 6: 配布員詳細ページにチェック周期設定を追加

**Files:**
- Modify: `src/app/distributors/[id]/page.tsx` (編集モーダル内)

- [ ] **Step 1: 編集モーダルの「レート・評価」タブにチェック周期フィールド追加**

- 「チェック周期（日）」数値入力
- プレースホルダー: 「未設定（デフォルト: 30日）」
- 保存時に `inspectionInterval` を更新

- [ ] **Step 2: Commit**

---

### Task 7: 本番DBマイグレーション + バックフィル

- [ ] **Step 1: 本番DBにスキーマ反映**
```bash
ssh production "cd ~/pms_java && npx prisma db push"
```

- [ ] **Step 2: バックフィルスクリプト実行**

- [ ] **Step 3: 動作確認**
