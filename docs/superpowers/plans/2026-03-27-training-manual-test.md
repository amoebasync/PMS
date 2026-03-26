# 配布員研修マニュアル＆テスト機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配布員がモバイルからマニュアルを閲覧し、管理者が割り当てた理解度テストを受験できる機能を実装する

**Architecture:** PDFマニュアルは管理者がアップロード→サーバーでページ分割→S3保存→配布員がカルーセルUIで閲覧。テストは管理者が問題プールを作成し、配布員に個別割当→LINE通知→モバイルで10問ランダム受験（1問ずつ即時フィードバック）→合格でステータス更新+管理者通知。

**Tech Stack:** Next.js App Router, Prisma, Tailwind CSS, S3 (@aws-sdk/client-s3), LINE Messaging API, sharp (画像変換)

**Spec:** `docs/superpowers/specs/2026-03-27-training-manual-test-design.md`

---

## Task 1: Prisma スキーマ — 新モデル・Enum追加

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: QuestionType / TestAssignmentStatus Enum 追加**

`prisma/schema.prisma` の Enum セクション（`AdminNotificationType` の後、L1079付近）に追加:

```prisma
// --- 研修テスト問題種別 ---
enum QuestionType {
  MULTIPLE_CHOICE  // 4択
  TRUE_FALSE       // ○×
  IMAGE            // 画像付き

  @@map("question_type")
}

// --- テスト割当ステータス ---
enum TestAssignmentStatus {
  PENDING    // 未受験
  PASSED     // 合格

  @@map("test_assignment_status")
}
```

- [ ] **Step 2: AdminNotificationType に TRAINING_TEST_PASSED を追加**

`prisma/schema.prisma` L1075-1079 の `AdminNotificationType` enum に追加:

```prisma
enum AdminNotificationType {
  DISTRIBUTION_START    // 配布開始
  DISTRIBUTION_FINISH   // 配布完了
  ALERT                 // アラート通知
  TRAINING_TEST_PASSED  // 研修テスト合格
}
```

- [ ] **Step 3: TrainingManualPage モデル追加**

```prisma
model TrainingManualPage {
  id             Int      @id @default(autoincrement())
  language       String   @db.VarChar(5)
  pageNumber     Int      @map("page_number")
  imageUrl       String   @map("image_url") @db.Text
  manualVersion  String   @map("manual_version") @db.VarChar(20)
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([language, pageNumber, manualVersion])
  @@map("training_manual_pages")
}
```

- [ ] **Step 4: TrainingQuestion / TrainingChoice モデル追加**

```prisma
model TrainingQuestion {
  id              Int              @id @default(autoincrement())
  type            QuestionType
  questionJa      String           @map("question_ja") @db.Text
  questionEn      String           @map("question_en") @db.Text
  imageUrl        String?          @map("image_url") @db.Text
  explanationJa   String           @map("explanation_ja") @db.Text
  explanationEn   String           @map("explanation_en") @db.Text
  isActive        Boolean          @default(true) @map("is_active")
  sortOrder       Int              @default(0) @map("sort_order")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")
  choices         TrainingChoice[]

  @@map("training_questions")
}

model TrainingChoice {
  id              Int              @id @default(autoincrement())
  questionId      Int              @map("question_id")
  question        TrainingQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  choiceTextJa    String           @map("choice_text_ja") @db.VarChar(500)
  choiceTextEn    String           @map("choice_text_en") @db.VarChar(500)
  isCorrect       Boolean          @default(false) @map("is_correct")
  sortOrder       Int              @default(0) @map("sort_order")

  @@map("training_choices")
}
```

- [ ] **Step 5: TrainingTestAssignment / TrainingTestResult モデル追加**

```prisma
model TrainingTestAssignment {
  id              Int                    @id @default(autoincrement())
  distributorId   Int                    @map("distributor_id")
  distributor     FlyerDistributor       @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  assignedById    Int                    @map("assigned_by_id")
  assignedBy      Employee               @relation("TestAssigner", fields: [assignedById], references: [id])
  status          TestAssignmentStatus   @default(PENDING)
  assignedAt      DateTime               @default(now()) @map("assigned_at")
  passedAt        DateTime?              @map("passed_at")
  results         TrainingTestResult[]

  @@map("training_test_assignments")
}

model TrainingTestResult {
  id              Int                    @id @default(autoincrement())
  assignmentId    Int                    @map("assignment_id")
  assignment      TrainingTestAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  score           Int
  totalQuestions  Int                    @map("total_questions")
  isPassed        Boolean                @map("is_passed")
  attemptNumber   Int                    @default(1) @map("attempt_number")
  questionIds     Json                   @map("question_ids")
  answers         Json
  completedAt     DateTime               @default(now()) @map("completed_at")

  @@map("training_test_results")
}
```

- [ ] **Step 6: FlyerDistributor モデルにフィールド追加**

`prisma/schema.prisma` L720付近（`note` フィールドの上あたり）に追加:

```prisma
  // 研修テスト
  isTrainingTestPassed  Boolean   @default(false) @map("is_training_test_passed")
  trainingTestPassedAt  DateTime? @map("training_test_passed_at")
```

L743付近（リレーション末尾）に追加:

```prisma
  testAssignments       TrainingTestAssignment[]
```

- [ ] **Step 7: Employee モデルにリレーション追加**

`prisma/schema.prisma` L228付近（Employee のリレーション末尾）に追加:

```prisma
  // 研修テスト割当
  testAssignments       TrainingTestAssignment[] @relation("TestAssigner")
```

- [ ] **Step 8: DB反映**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 9: コミット**

```bash
git add prisma/schema.prisma
git commit -m "feat: add training manual & test models to Prisma schema"
```

---

## Task 2: マニュアルアップロードAPI（管理者）

**Files:**
- Create: `src/app/api/training-manuals/upload/route.ts`
- Create: `src/app/api/training-manuals/route.ts`

**依存パッケージ:** `sharp`（画像変換用、既存の package.json を確認して未インストールなら追加）

- [ ] **Step 1: sharp がインストール済みか確認、必要なら追加**

```bash
grep '"sharp"' package.json || npm install --legacy-peer-deps sharp
```

- [ ] **Step 2: PDF→画像変換用のpdf2pic または pdf-poppler を追加**

本番EC2環境でも動作する `pdf2pic` を使用（内部で GraphicsMagick/ImageMagick を利用）。ただし EC2 に依存ツールが必要なため、代わりに **クライアント側で PDF.js を使ってページごとにcanvasレンダリング→画像化→サーバーへ送信** するアプローチを採用する。

管理者がPDFを選択 → ブラウザ側でPDF.jsを使い各ページをPNG化 → 各ページ画像をサーバーAPIへ送信 → サーバーはWebP変換してS3保存。

```bash
npm install --legacy-peer-deps pdfjs-dist
```

- [ ] **Step 3: マニュアルページアップロードAPI作成**

`src/app/api/training-manuals/upload/route.ts`:

```typescript
// POST /api/training-manuals/upload
// multipart/form-data: { file (PNG/JPG image), language, version, pageNumber }
// 1ページずつ受信→sharp でWebP変換→S3アップロード→DBレコード作成
// S3キー: uploads/training-manuals/{language}/{version}/page-{pageNumber}.webp

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { uploadToS3, toProxyUrl } from '@/lib/s3';
import sharp from 'sharp';

export async function POST(request: Request) {
  // 1. pms_session 認証チェック
  // 2. FormData から file, language, version, pageNumber を取得
  // 3. sharp で WebP 変換（quality: 85, max width: 1200px）
  // 4. S3 アップロード
  // 5. TrainingManualPage upsert（同じ language+pageNumber+version があれば更新）
  // 6. proxy URL を返却
}
```

- [ ] **Step 4: マニュアル一覧・削除API作成**

`src/app/api/training-manuals/route.ts`:

```typescript
// GET /api/training-manuals?language=en&version=1.0
//   → TrainingManualPage 一覧（pageNumber順）
// DELETE /api/training-manuals?language=en&version=1.0
//   → 指定バージョンの全ページを S3 削除 + DB削除

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { deleteFromS3 } from '@/lib/s3';
```

- [ ] **Step 5: コミット**

```bash
git add src/app/api/training-manuals/
git commit -m "feat: add training manual upload/list/delete APIs"
```

---

## Task 3: マニュアル管理UI（管理者 /settings タブ）

**Files:**
- Create: `src/components/settings/TrainingManualUpload.tsx`
- Modify: `src/app/settings/page.tsx` (TabKey に `trainingManual` 追加、タブグループに追加)
- Modify: `src/i18n/locales/ja/settings.json` (翻訳キー追加)
- Modify: `src/i18n/locales/en/settings.json` (翻訳キー追加)

- [ ] **Step 1: TrainingManualUpload コンポーネント作成**

`src/components/settings/TrainingManualUpload.tsx`:

```
機能:
- PDFファイル選択（input type="file" accept=".pdf"）
- 言語選択（ja/en ドロップダウン）
- バージョン入力（テキスト、例: "1.0"）
- 「アップロード」ボタン
  → PDF.js でブラウザ側ページ分割
  → 各ページを canvas レンダリング → toBlob → FormData
  → /api/training-manuals/upload に1ページずつ POST
  → プログレスバー表示（1/8, 2/8...）
- アップロード済みマニュアル一覧
  → GET /api/training-manuals でバージョン一覧
  → サムネイルグリッド表示
  → 削除ボタン（確認ダイアログ付き）
```

- [ ] **Step 2: settings/page.tsx に trainingManual タブを追加**

`src/app/settings/page.tsx`:

1. `TabKey` 型に `'trainingManual'` を追加（L51）
2. `tabGroups` の `group_recruiting` グループに追加（L590-593付近）:
   ```typescript
   { key: 'trainingManual' as const, label: t('tab_trainingManual'), icon: 'bi-book' },
   ```
3. `isMasterTab` の条件に `tab !== 'trainingManual'` を追加（L614）
4. タブコンテンツ部分に `TrainingManualUpload` コンポーネントを配置
5. `import TrainingManualUpload from '@/components/settings/TrainingManualUpload';` を追加

- [ ] **Step 3: i18n 翻訳キー追加**

`src/i18n/locales/ja/settings.json` に追加:
```json
"tab_trainingManual": "研修マニュアル",
"manual_upload_title": "マニュアルアップロード",
"manual_language": "言語",
"manual_version": "バージョン",
"manual_upload": "アップロード",
"manual_uploading": "アップロード中...",
"manual_upload_progress": "ページ {current}/{total} アップロード中...",
"manual_uploaded_list": "アップロード済みマニュアル",
"manual_no_data": "マニュアルはまだアップロードされていません",
"manual_delete_confirm": "このバージョンのマニュアルを削除しますか？",
"manual_pages": "{count}ページ"
```

`src/i18n/locales/en/settings.json` に同等の英語キーを追加。

- [ ] **Step 4: コミット**

```bash
git add src/components/settings/TrainingManualUpload.tsx src/app/settings/page.tsx src/i18n/locales/
git commit -m "feat: add training manual upload UI in settings"
```

---

## Task 4: マニュアル閲覧API・UI（配布員）

**Files:**
- Create: `src/app/api/staff/training-manual/route.ts`
- Create: `src/app/staff/manual/page.tsx`
- Create: `src/app/staff/en/manual/page.tsx`

- [ ] **Step 1: 配布員用マニュアルAPI**

`src/app/api/staff/training-manual/route.ts`:

```typescript
// GET /api/staff/training-manual
// pms_distributor_session から配布員を特定 → language を取得
// → TrainingManualPage を language + isActive=true + 最新version で取得
// → pageNumber 昇順で返却
// レスポンス: { pages: [{ pageNumber, imageUrl }], version, totalPages }
```

- [ ] **Step 2: マニュアル閲覧ページ（日本語版）**

`src/app/staff/manual/page.tsx`:

```
レスポンシブカルーセルUI:
- GET /api/staff/training-manual でページ画像一覧を取得
- 状態: currentPage, pages[], loading
- モバイル（default）:
  - 1ページずつ表示（画像 w-full）
  - スワイプ対応（touch events: touchstart/touchmove/touchend）
  - ピンチズーム（CSS touch-action: pinch-zoom）
  - 下部にページインジケーター「1 / 8」
  - 前へ/次へボタン（画面下部固定）
- タブレット（md:）:
  - 同上だがカード幅を広げる（max-w-2xl）
- PC（lg:）:
  - 中央寄せ max-w-2xl
  - 左右矢印キーでページ遷移（useEffect で keydown イベント）
  - 左右に大きな矢印ボタン

共通:
- ローディングスケルトン
- 画像プリロード（次のページを先読み）
- 「マニュアルがありません」表示（pages.length === 0）
- ヘッダー: 「マニュアル」タイトル
```

- [ ] **Step 3: マニュアル閲覧ページ（英語版）**

`src/app/staff/en/manual/page.tsx`:
- 日本語版と同じコンポーネントを使用するか、共通コンポーネントを切り出す
- テキストラベルのみ英語に変更

- [ ] **Step 4: コミット**

```bash
git add src/app/api/staff/training-manual/ src/app/staff/manual/ src/app/staff/en/manual/
git commit -m "feat: add training manual viewer for distributors"
```

---

## Task 5: 問題プール管理API（管理者）

**Files:**
- Create: `src/app/api/training-questions/route.ts`
- Create: `src/app/api/training-questions/[id]/route.ts`
- Create: `src/app/api/training-questions/upload-image/route.ts`

- [ ] **Step 1: 問題CRUD API**

`src/app/api/training-questions/route.ts`:

```typescript
// GET /api/training-questions
//   クエリ: isActive (optional)
//   include: { choices: { orderBy: { sortOrder: 'asc' } } }
//   orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]

// POST /api/training-questions
//   body: { type, questionJa, questionEn, imageUrl?, explanationJa, explanationEn, isActive, choices: [{ choiceTextJa, choiceTextEn, isCorrect, sortOrder }] }
//   → prisma.trainingQuestion.create({ data: { ..., choices: { create: [...] } } })
//   バリデーション:
//   - MULTIPLE_CHOICE: choices 4つ必須、isCorrect が1つだけ true
//   - TRUE_FALSE: choices 2つ必須（○/×）、isCorrect が1つだけ true
//   - IMAGE: imageUrl 必須 + choices 必須
```

- [ ] **Step 2: 問題個別更新/削除API**

`src/app/api/training-questions/[id]/route.ts`:

```typescript
// PUT /api/training-questions/[id]
//   body: 全フィールド + choices 配列
//   → 既存 choices を deleteMany → create し直す（upsert より安全）

// DELETE /api/training-questions/[id]
//   → isActive = false に論理削除
```

- [ ] **Step 3: 画像アップロードAPI**

`src/app/api/training-questions/upload-image/route.ts`:

```typescript
// POST /api/training-questions/upload-image
//   multipart/form-data: { file }
//   → sharp でリサイズ（max 800px width）+ WebP変換
//   → S3 uploads/training-questions/{timestamp}.webp
//   → { imageUrl: proxyUrl } を返却
```

- [ ] **Step 4: コミット**

```bash
git add src/app/api/training-questions/
git commit -m "feat: add training question CRUD and image upload APIs"
```

---

## Task 6: 問題プール管理UI（管理者 /settings タブ）

**Files:**
- Create: `src/components/settings/TrainingTestSettings.tsx`
- Create: `src/components/settings/TrainingQuestionModal.tsx`
- Modify: `src/app/settings/page.tsx` (TabKey に `trainingTest` 追加)
- Modify: `src/i18n/locales/ja/settings.json`
- Modify: `src/i18n/locales/en/settings.json`

- [ ] **Step 1: TrainingQuestionModal コンポーネント作成**

`src/components/settings/TrainingQuestionModal.tsx`:

```
問題作成/編集モーダル:
- 問題種別セレクト（4択/○×/画像付き）
  → 種別変更時に choices を適切にリセット
- 問題文（日本語）textarea
- 問題文（英語）textarea
- 画像アップロード（IMAGE type 時のみ表示）
  → /api/training-questions/upload-image に POST
  → プレビュー表示
- 選択肢セクション:
  - MULTIPLE_CHOICE: 4つの入力フィールド（ja/en）+ 正解ラジオボタン
  - TRUE_FALSE: 2つ固定（○/×）+ 正解ラジオボタン
  - IMAGE: MULTIPLE_CHOICE と同じ（画像は上部に表示）
- 解説（日本語）textarea
- 解説（英語）textarea
- 有効/無効 トグル
- 保存/キャンセルボタン
```

- [ ] **Step 2: TrainingTestSettings コンポーネント作成**

`src/components/settings/TrainingTestSettings.tsx`:

```
3セクション構成:

1. テスト設定セクション（上部）
   - 出題数（number input、デフォルト10）
   - 合格ライン（number input、デフォルト80%）
   - 保存ボタン → PUT /api/settings (SystemSetting更新)

2. 問題プールセクション（中部）
   - 「問題追加」ボタン → TrainingQuestionModal を開く
   - テーブル:
     | 種別バッジ | 問題文（先頭40文字） | 有効/無効 | 操作 |
     - 種別バッジ: 4択=blue, ○×=green, 画像=purple
     - 操作: 編集ボタン, 削除ボタン（確認ダイアログ）
   - フィルタ: 全て / 有効のみ / 無効のみ

3. テスト結果セクション（下部）→ Task 10 で実装
```

- [ ] **Step 3: settings/page.tsx に trainingTest タブ追加**

1. `TabKey` 型に `'trainingTest'` を追加
2. `tabGroups` の `group_recruiting` グループに追加:
   ```typescript
   { key: 'trainingTest' as const, label: t('tab_trainingTest'), icon: 'bi-pencil-square' },
   ```
3. `isMasterTab` の条件に `tab !== 'trainingTest'` を追加
4. タブコンテンツ分岐に `TrainingTestSettings` を配置
5. import 追加

- [ ] **Step 4: i18n 翻訳キー追加**

`ja/settings.json`:
```json
"tab_trainingTest": "研修テスト",
"test_settings_title": "テスト設定",
"test_question_count": "出題数",
"test_passing_rate": "合格ライン（%）",
"test_question_pool": "問題プール",
"test_add_question": "問題追加",
"test_question_type": "種別",
"test_question_text": "問題文",
"test_question_text_ja": "問題文（日本語）",
"test_question_text_en": "問題文（英語）",
"test_choices": "選択肢",
"test_correct_answer": "正解",
"test_explanation": "解説",
"test_explanation_ja": "解説（日本語）",
"test_explanation_en": "解説（英語）",
"test_image": "画像",
"test_type_multiple_choice": "4択",
"test_type_true_false": "○×",
"test_type_image": "画像付き",
"test_active": "有効",
"test_inactive": "無効",
"test_results_title": "テスト結果",
"test_no_questions": "問題はまだ登録されていません",
"test_delete_confirm": "この問題を削除しますか？"
```

`en/settings.json` に同等の英語翻訳を追加。

- [ ] **Step 5: コミット**

```bash
git add src/components/settings/TrainingTestSettings.tsx src/components/settings/TrainingQuestionModal.tsx src/app/settings/page.tsx src/i18n/locales/
git commit -m "feat: add training test question pool management UI"
```

---

## Task 7: テスト割当API + LINE通知

**Files:**
- Create: `src/app/api/training-test-assignments/route.ts`
- Modify: `src/lib/line.ts` (テスト割当通知メッセージ追加)

- [ ] **Step 1: テスト割当API**

`src/app/api/training-test-assignments/route.ts`:

```typescript
// POST /api/training-test-assignments
//   body: { distributorId }
//   pms_session 認証（管理者）
//   バリデーション:
//   - distributorId が存在するか
//   - 既にPENDINGの割当がないか（ある場合 400）
//   処理:
//   1. TrainingTestAssignment 作成（status: PENDING）
//   2. 配布員の LineUser を取得
//   3. LINE push メッセージ送信（テスト受験リンク付き）
//   4. 監査ログ記録
//   レスポンス: 作成した assignment

// GET /api/training-test-assignments
//   クエリ: distributorId?, status?
//   include: { distributor: { select: { id, staffId, name } }, assignedBy: { select: { id, lastNameJa, firstNameJa } }, results: true }
//   orderBy: { assignedAt: 'desc' }
```

- [ ] **Step 2: LINE通知メッセージ関数追加**

`src/lib/line.ts` に追加:

```typescript
export function buildTrainingTestMessage(distributorName: string, portalUrl: string) {
  return [
    {
      type: 'text' as const,
      text: `${distributorName}さん\n\n研修テストが届きました。\n以下のリンクから受験してください。\n\nA training test has been assigned to you.\nPlease take the test from the link below.\n\n${portalUrl}/staff/test`
    }
  ];
}
```

- [ ] **Step 3: コミット**

```bash
git add src/app/api/training-test-assignments/ src/lib/line.ts
git commit -m "feat: add training test assignment API with LINE notification"
```

---

## Task 8: テスト受験API（配布員）

**Files:**
- Create: `src/app/api/staff/training-test/route.ts`
- Create: `src/app/api/staff/training-test/start/route.ts`
- Create: `src/app/api/staff/training-test/answer/route.ts`
- Create: `src/app/api/staff/training-test/complete/route.ts`

- [ ] **Step 1: テスト状態確認API**

`src/app/api/staff/training-test/route.ts`:

```typescript
// GET /api/staff/training-test
//   pms_distributor_session → distributorId
//   1. PENDING の割当を取得
//   2. 過去の結果一覧も取得（最新5件）
//   レスポンス: {
//     pendingAssignment: { id, assignedAt } | null,
//     pastResults: [{ id, score, totalQuestions, isPassed, attemptNumber, completedAt }]
//   }
```

- [ ] **Step 2: テスト開始API**

`src/app/api/staff/training-test/start/route.ts`:

```typescript
// POST /api/staff/training-test/start
//   body: { assignmentId }
//   pms_distributor_session → distributorId
//   バリデーション:
//   - assignment が自分宛か
//   - assignment.status が PENDING か
//   処理:
//   1. SystemSetting から trainingTestQuestionCount を取得（デフォルト10）
//   2. isActive=true の問題からランダムに N 問選択
//      → prisma で全IDを取得 → JS でシャッフル → 先頭N件
//   3. 選択された問題の choices も取得（sortOrder シャッフル）
//   4. TrainingTestResult 作成（attemptNumber = 既存結果数 + 1, score=0, answers=[]）
//   5. 問題データを返却（正解情報は含めない！）
//   レスポンス: {
//     resultId: number,
//     questions: [{ id, type, question, imageUrl?, choices: [{ id, text }] }]
//   }
//   ※ question は配布員の language に応じて ja/en を選択
//   ※ choices の text も language に応じて ja/en を選択
//   ※ choices の isCorrect は返さない
```

- [ ] **Step 3: 1問回答API**

`src/app/api/staff/training-test/answer/route.ts`:

```typescript
// POST /api/staff/training-test/answer
//   body: { resultId, questionId, choiceId }
//   pms_distributor_session → distributorId
//   バリデーション:
//   - result が自分の assignment に紐づくか
//   - questionId が result.questionIds に含まれるか
//   - この問題にまだ回答していないか（answers JSON チェック）
//   処理:
//   1. TrainingChoice を取得して isCorrect を確認
//   2. 正解の choice を取得
//   3. TrainingQuestion の explanation を取得
//   4. result.answers JSON に追記
//   5. result.score を更新（正解なら +1）
//   レスポンス: {
//     isCorrect: boolean,
//     correctChoiceId: number,
//     explanation: string  // 配布員の language に応じて ja/en
//   }
```

- [ ] **Step 4: テスト完了API**

`src/app/api/staff/training-test/complete/route.ts`:

```typescript
// POST /api/staff/training-test/complete
//   body: { resultId }
//   pms_distributor_session → distributorId
//   バリデーション:
//   - result が自分のか
//   - 全問回答済みか（answers.length === totalQuestions）
//   処理:
//   1. SystemSetting から trainingTestPassingRate を取得（デフォルト80）
//   2. 合格判定: (score / totalQuestions * 100) >= passingRate
//   3. result.isPassed を更新
//   4. 合格の場合:
//      a. assignment.status → PASSED, passedAt → now()
//      b. distributor.isTrainingTestPassed → true, trainingTestPassedAt → now()
//      c. AdminNotification 作成（type: TRAINING_TEST_PASSED）
//   レスポンス: { score, totalQuestions, isPassed, passingScore }
```

- [ ] **Step 5: コミット**

```bash
git add src/app/api/staff/training-test/
git commit -m "feat: add training test taking APIs (start/answer/complete)"
```

---

## Task 9: テスト受験UI（配布員モバイル）

**Files:**
- Create: `src/app/staff/test/page.tsx`
- Create: `src/app/staff/en/test/page.tsx`

- [ ] **Step 1: テスト受験ページ作成**

`src/app/staff/test/page.tsx`:

```
状態管理:
- phase: 'home' | 'quiz' | 'result'
- assignment: PENDINGの割当情報
- questions: 出題された問題配列
- currentIndex: 現在の問題番号（0-based）
- resultId: テスト結果ID
- answers: 回答済みの配列 [{ questionId, choiceId, isCorrect, correctChoiceId, explanation }]
- selectedChoiceId: 現在選択中の選択肢
- showFeedback: フィードバック表示中フラグ
- score: 現在の正解数
- pastResults: 過去のテスト結果

--- phase: 'home' ---
1. GET /api/staff/training-test でPENDING確認 + 過去結果
2. PENDINGあり → 「テストを受験する」大きなボタン（indigo-600）
   → クリックで POST /api/staff/training-test/start
   → phase → 'quiz'
3. PENDINGなし → 「現在テストはありません」メッセージ
4. 過去結果一覧（カード形式、スコア + 合格/不合格バッジ + 日時）

--- phase: 'quiz' ---
1. プログレスバー（上部固定、indigo-600、幅 = (currentIndex+1)/total * 100%）
2. 問題番号「問題 {n} / {total}」（テキスト）
3. 問題文（大きめのテキスト、text-lg font-semibold）
4. 画像（IMAGE type の場合、タップで拡大モーダル）
5. 選択肢ボタン:
   - 未回答時: border-slate-200 bg-white、タップで selectedChoiceId を更新
   - 選択中: border-indigo-500 bg-indigo-50
   - 「回答する」ボタン（selectedChoiceId がある時のみ有効）
6. フィードバック表示（showFeedback = true）:
   - 正解: 選択した選択肢を bg-emerald-50 border-emerald-500 + チェックマーク
   - 不正解: 選択した選択肢を bg-rose-50 border-rose-400 + バツ
              正解の選択肢を bg-emerald-50 border-emerald-500 + チェック
   - 解説テキスト（bg-slate-50 rounded-xl p-4）
   - 「次の問題へ」ボタン（最終問題の場合は「結果を見る」）
     → currentIndex++ or POST /api/staff/training-test/complete

--- phase: 'result' ---
1. スコア大表示（円形プログレスorテキスト）: 8/10
2. 合格: 緑チェック + 「合格！おめでとうございます！」
   不合格: 赤バツ + 「不合格 — もう一度挑戦してください」
3. 合格ライン表示「合格ライン: 80%」
4. 回答サマリー（各問題のカード: 問題文先頭 + 正解/不正解バッジ）
5. 不合格時: 「もう一度受験する」ボタン
   → POST /api/staff/training-test/start で再テスト
6. 「ホームに戻る」ボタン → /staff

デザインルール:
- max-w-lg mx-auto（既存 staff レイアウトに合わせる）
- 選択肢ボタン: min-h-[48px] で大きなタップ領域
- 色: indigo-600 (primary), emerald-500 (正解), rose-400 (不正解)
- フォント: text-lg (問題文), text-sm (選択肢), text-xs (補足)
```

- [ ] **Step 2: 英語版ルート作成**

`src/app/staff/en/test/page.tsx`:
- 日本語版と共通コンポーネントを使用
- テキストラベルを英語に（または配布員の language 設定で自動切替）

- [ ] **Step 3: コミット**

```bash
git add src/app/staff/test/ src/app/staff/en/test/
git commit -m "feat: add mobile training test taking UI for distributors"
```

---

## Task 10: テスト結果API・UI（管理者）

**Files:**
- Create: `src/app/api/training-test-results/route.ts`
- Create: `src/app/api/training-test-results/[id]/route.ts`
- Modify: `src/components/settings/TrainingTestSettings.tsx` (結果セクション追加)

- [ ] **Step 1: テスト結果一覧API**

`src/app/api/training-test-results/route.ts`:

```typescript
// GET /api/training-test-results
//   クエリ: distributorId?, isPassed?, from?, to?
//   include: {
//     assignment: {
//       include: {
//         distributor: { select: { id, staffId, name } },
//         assignedBy: { select: { id, lastNameJa, firstNameJa } }
//       }
//     }
//   }
//   orderBy: { completedAt: 'desc' }
```

- [ ] **Step 2: テスト結果詳細API**

`src/app/api/training-test-results/[id]/route.ts`:

```typescript
// GET /api/training-test-results/[id]
//   include: assignment + distributor
//   answers JSON を展開して、各問題の questionText と correctChoice も含めて返却
```

- [ ] **Step 3: TrainingTestSettings に結果セクション追加**

`src/components/settings/TrainingTestSettings.tsx` の下部に追加:

```
テスト結果セクション:
- GET /api/training-test-results で取得
- テーブル:
  | 配布員名 | スタッフID | スコア | 結果バッジ | 試行回数 | 受験日時 |
  - 結果バッジ: 合格=emerald, 不合格=rose
- フィルタ: 合格/不合格/全て
- 行クリックで詳細モーダル（個別回答内容表示）
```

- [ ] **Step 4: コミット**

```bash
git add src/app/api/training-test-results/ src/components/settings/TrainingTestSettings.tsx
git commit -m "feat: add training test results API and admin UI"
```

---

## Task 11: 配布員管理画面にテスト送信ボタン追加

**Files:**
- Modify: `src/app/distributors/page.tsx`

- [ ] **Step 1: テスト送信ボタンをテーブルに追加**

`src/app/distributors/page.tsx`:

```
変更内容:
1. 配布員の型に isTrainingTestPassed, testAssignments を追加
2. fetch URL に include パラメータ追加（または API 側で自動 include）
3. テーブルの各行に「テスト」列を追加:
   - 未割当 & 未合格: 「テスト送信」ボタン（indigo-600）
   - PENDING: 「受験待ち」バッジ（amber-500）
   - PASSED: 「合格済」バッジ（emerald-500）+ 合格日
4. 「テスト送信」クリック → 確認ダイアログ
   → POST /api/training-test-assignments { distributorId }
   → 成功トースト「テストを送信しました」
   → リスト再取得
```

- [ ] **Step 2: GET /api/distributors でテスト関連データを含める**

配布員一覧APIで `isTrainingTestPassed` と最新の `testAssignments` の status を返すように修正。
（大量のリレーション include を避けるため、select で最小限のフィールドのみ取得）

- [ ] **Step 3: i18n 翻訳キー追加**

`ja/distributors.json`:
```json
"send_test": "テスト送信",
"test_pending": "受験待ち",
"test_passed": "合格済",
"send_test_confirm": "{name}さんに研修テストを送信しますか？",
"send_test_success": "テストを送信しました",
"test_already_pending": "既にテストが送信済みです"
```

`en/distributors.json` に英語版追加。

- [ ] **Step 4: コミット**

```bash
git add src/app/distributors/page.tsx src/i18n/locales/
git commit -m "feat: add test assignment button to distributor management page"
```

---

## Task 12: 管理者通知（テスト合格時）

**Files:**
- Modify: `src/components/NotificationBell.tsx`

- [ ] **Step 1: NotificationBell にテスト合格通知の表示を追加**

`src/components/NotificationBell.tsx`:

通知タイプ分岐（L281-305付近）に `TRAINING_TEST_PASSED` を追加:

```typescript
case 'TRAINING_TEST_PASSED':
  // アイコン: bi-mortarboard（卒業帽）、色: emerald
  // クリック時: /distributors ページへ遷移（配布員管理画面）
  break;
```

- [ ] **Step 2: コミット**

```bash
git add src/components/NotificationBell.tsx
git commit -m "feat: add training test passed notification type"
```

---

## Task 13: 初期問題データシード

**Files:**
- Create: `scripts/seed-training-questions.ts`

- [ ] **Step 1: シードスクリプト作成**

`scripts/seed-training-questions.ts`:

マニュアル内容に基づく20問を以下の5カテゴリで作成:

```
カテゴリ1: 日常業務手順（4問）
  Q1: 出社時間帯（4択）7am-10am
  Q2: 配布開始時にやること（4択）LINEで写真送信+アプリ開始報告
  Q3: 配布終了時刻（4択）11pm/23時
  Q4: 10時以降に出社する場合の対応（4択）LINEで連絡

カテゴリ2: 報酬体系（3問）
  Q5: 報酬の計算基準（4択）ポスト数
  Q6: エリアランクCCCの単価加算（4択）+0.50
  Q7: 昇給条件に含まれないもの（4択）引っかけ

カテゴリ3: 報告・支払い（3問）
  Q8: シフト報告の締切（4択）毎週金曜
  Q9: 交通費申請の締切（4択）毎週火曜
  Q10: 振込手数料（4択）250円

カテゴリ4: 配布ルール（7問）
  Q11: 指定エリア外に配布してよいか（○×）False
  Q12: チラシお断りステッカーのポスト（○×）False（配布しない）
  Q13: 管理室ポストへの配布（○×）False
  Q14: 満杯ポストへの配布（○×）False
  Q15: 同じチラシの重複投函（○×）False
  Q16: 「チラシ禁止・警察通報」掲示のある建物（4択）配布してよい ← 引っかけ問題
  Q17: 「罰金」の掲示がある建物（4択）スキップ

カテゴリ5: 不正行為（3問）
  Q18: 不正行為に該当するもの（4択）チラシの意図的廃棄
  Q19: 不正行為の結果（4択）損害賠償・ビザ取消の可能性
  Q20: チラシの投函方法（○×）奥までしっかり入れる → True

各問題に日本語・英語の問題文、選択肢、解説を含む。
```

- [ ] **Step 2: シード実行テスト**

```bash
npx tsx scripts/seed-training-questions.ts
```

- [ ] **Step 3: コミット**

```bash
git add scripts/seed-training-questions.ts
git commit -m "feat: add seed script for 20 training test questions"
```

---

## Task 14: Middleware更新 + i18n + 最終調整

**Files:**
- Modify: `src/middleware.ts` （不要 — `/staff/*` と `/api/staff/*` は既に pms_distributor_session で保護されているため、新しいパスの追加は不要）
- Create: `src/i18n/locales/ja/trainingTest.json`
- Create: `src/i18n/locales/en/trainingTest.json`

- [ ] **Step 1: Middleware確認**

`/staff/manual` と `/staff/test` は既存の `/staff` パスパターンで自動保護される。
`/api/staff/training-manual` と `/api/staff/training-test/*` は既存の `/api/staff/` パスパターンで自動保護される。
管理者API（`/api/training-manuals/`, `/api/training-questions/`, `/api/training-test-assignments/`, `/api/training-test-results/`）は管理者パスなので既存のパス制御で `pms_session` が必要。

→ **Middleware の変更は不要**。

- [ ] **Step 2: 配布員テストページ用i18nファイル作成**

配布員ポータルは `useTranslation` を使わず直接テキストを書くパターン（既存の shifts, expenses 等と同様）。配布員の `language` フィールドで ja/en を切り替える方式。

→ `/staff/test/page.tsx` と `/staff/en/test/page.tsx` で対応済み（Task 9）。
→ `/staff/manual/page.tsx` と `/staff/en/manual/page.tsx` で対応済み（Task 4）。

管理者用の i18n は Task 3, 6 で `settings.json` に追加済み。

- [ ] **Step 3: SystemSetting 初期値をシードに追加**

`scripts/seed-training-questions.ts` の末尾に追加:

```typescript
// テスト設定の初期値
await prisma.systemSetting.upsert({
  where: { key: 'trainingTestQuestionCount' },
  update: {},
  create: { key: 'trainingTestQuestionCount', value: '10' },
});
await prisma.systemSetting.upsert({
  where: { key: 'trainingTestPassingRate' },
  update: {},
  create: { key: 'trainingTestPassingRate', value: '80' },
});
```

- [ ] **Step 4: npm run build で全体ビルド確認**

```bash
npm run build
```

エラーがあれば修正。

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "feat: finalize training manual & test feature"
```

---

## 実装順序の依存関係

```
Task 1 (Schema)
  ├── Task 2 (Manual Upload API) → Task 3 (Manual Admin UI)
  │                               → Task 4 (Manual Viewer)
  ├── Task 5 (Question API) → Task 6 (Question Admin UI)
  │                         → Task 13 (Seed Data)
  ├── Task 7 (Assignment API) → Task 11 (Distributor Page Button)
  ├── Task 8 (Test Taking API) → Task 9 (Test Taking UI)
  ├── Task 10 (Results API/UI)
  ├── Task 12 (Notification Bell)
  └── Task 14 (Final Adjustments)
```

並列実行可能なグループ:
- **グループA** (マニュアル): Task 2 → Task 3, Task 4
- **グループB** (テスト問題): Task 5 → Task 6, Task 13
- **グループC** (テスト受験): Task 7, Task 8 → Task 9
- **グループD** (管理統合): Task 10, Task 11, Task 12

全グループは Task 1 完了後に並列開始可能。
