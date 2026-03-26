# 配布員研修マニュアル＆テスト機能 設計書

作成日: 2026-03-27

## 1. 概要

チラシ配布員の研修で使うマニュアル閲覧機能と理解度テスト機能を開発する。

### 目的
- 配布員がスマートフォンからマニュアルを閲覧できる
- 管理者がテストを配布員に個別割当し、理解度を確認できる
- テスト合格で研修完了フラグを立て、管理者に通知する

### 対象ユーザー
- **配布員（FlyerDistributor）**: マニュアル閲覧 + テスト受験（モバイル中心）
- **管理者（Employee）**: マニュアル管理 + 問題プール管理 + テスト割当 + 結果確認

---

## 2. マニュアル閲覧機能

### 2.1 概要
- PDFマニュアルを管理者がアップロード → サーバー側でページ分割 → S3に画像保存
- 配布員はLINEリッチメニューの「マニュアル」から `/staff/manual` にアクセス
- 言語: 英語版 + 日本語版（配布員の言語設定で自動切替）

### 2.2 データモデル

```prisma
model TrainingManualPage {
  id             Int      @id @default(autoincrement())
  language       String   @db.VarChar(5)   // "ja" | "en"
  pageNumber     Int
  imageUrl       String   @db.Text         // S3 proxy URL
  manualVersion  String   @db.VarChar(20)  // "1.0", "1.1" etc.
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([language, pageNumber, manualVersion])
  @@map("training_manual_pages")
}
```

### 2.3 S3ストレージ
- キー: `uploads/training-manuals/{language}/{version}/page-{pageNumber}.webp`
- 画像形式: WebP（高圧縮・高画質、モバイル最適）
- アップロードフロー:
  1. 管理者がPDFアップロード（`/api/training-manuals/upload`）
  2. サーバーでPDF→ページごとPNG変換（`pdf-poppler` or `sharp`）
  3. WebPに変換 → S3アップロード
  4. `TrainingManualPage` レコード作成

### 2.4 管理者API

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/training-manuals/upload` | PDFアップロード（multipart/form-data: file, language, version） |
| `GET` | `/api/training-manuals` | マニュアルページ一覧（language, version フィルタ） |
| `DELETE` | `/api/training-manuals?language=xx&version=xx` | 指定バージョン一括削除 |

### 2.5 配布員API

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/staff/training-manual` | 配布員の言語設定に応じたアクティブなマニュアルページ一覧 |

### 2.6 配布員UI（`/staff/manual`）

#### レスポンシブデザイン
- **モバイル**: フルスクリーンカルーセル、スワイプでページ遷移、ピンチズーム対応
- **タブレット**: 横向き最適化、2ページ見開き表示オプション
- **PC**: 中央寄せ表示（max-w-2xl）、矢印キーでページ遷移

#### UI要素
- ページインジケーター（1/8, 2/8...）
- 前へ/次へボタン
- ページサムネイル一覧（クイックジャンプ）
- ピンチズーム（モバイル）
- 言語切替ボタン（利用可能な場合）

### 2.7 管理者UI（`/settings` → 「研修マニュアル」セクション）
- アップロードフォーム: PDFファイル、言語選択(ja/en)、バージョン入力
- アップロード済みマニュアル一覧: 言語、バージョン、ページ数、アップロード日
- プレビュー: サムネイル表示
- 削除: バージョン一括削除（確認ダイアログ付き）

---

## 3. 理解度テスト機能

### 3.1 概要
- 管理者が問題プール（20問以上）を作成・管理
- 管理者が配布員を選んでテスト受験を割当 → LINE通知
- 配布員はモバイルで10問をランダム受験（プールからランダム選択、順番もランダム）
- 1問ずつ即時フィードバック（正解/不正解 + 解説）
- 合格: 80%以上（10問中8問正解）
- 不合格: すぐに再受験可（再受験時は再度ランダム出題）
- 合格時: DBに記録 + 配布員ステータス更新 + 管理者通知

### 3.2 問題形式

| 種別 | 説明 |
|---|---|
| **4択問題（MULTIPLE_CHOICE）** | 4つの選択肢から1つを選ぶ |
| **○×問題（TRUE_FALSE）** | 正しい/間違いの2択 |
| **画像付き問題（IMAGE）** | 写真を見て回答（例：「このポストに配布してよいか？」） |

### 3.3 データモデル

```prisma
enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE
  IMAGE

  @@map("question_type")
}

enum TestAssignmentStatus {
  PENDING       // 未受験
  PASSED        // 合格
  FAILED        // 最終不合格（現状は使わない、すぐ再受験可のため）

  @@map("test_assignment_status")
}

model TrainingQuestion {
  id              Int              @id @default(autoincrement())
  type            QuestionType
  questionJa      String           @db.Text
  questionEn      String           @db.Text
  imageUrl        String?          @db.Text    // IMAGE type用
  explanationJa   String           @db.Text    // 解説（日本語）
  explanationEn   String           @db.Text    // 解説（英語）
  isActive        Boolean          @default(true)
  sortOrder       Int              @default(0)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  choices         TrainingChoice[]

  @@map("training_questions")
}

model TrainingChoice {
  id              Int              @id @default(autoincrement())
  questionId      Int
  question        TrainingQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  choiceTextJa    String           @db.VarChar(500)
  choiceTextEn    String           @db.VarChar(500)
  isCorrect       Boolean          @default(false)
  sortOrder       Int              @default(0)

  @@map("training_choices")
}

model TrainingTestAssignment {
  id              Int                    @id @default(autoincrement())
  distributorId   Int
  distributor     FlyerDistributor       @relation(fields: [distributorId], references: [id], onDelete: Cascade)
  assignedById    Int
  assignedBy      Employee               @relation(fields: [assignedById], references: [id])
  status          TestAssignmentStatus   @default(PENDING)
  assignedAt      DateTime               @default(now())
  passedAt        DateTime?              // 合格日時
  results         TrainingTestResult[]

  @@map("training_test_assignments")
}

model TrainingTestResult {
  id              Int                    @id @default(autoincrement())
  assignmentId    Int
  assignment      TrainingTestAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  score           Int                    // 正解数
  totalQuestions  Int                    // 出題数 (10)
  isPassed        Boolean
  attemptNumber   Int                    @default(1)
  questionIds     Json                   // 出題された問題ID配列 [1,5,8,...]
  answers         Json                   // 回答 [{questionId: 1, choiceId: 3, isCorrect: true}, ...]
  completedAt     DateTime               @default(now())

  @@map("training_test_results")
}
```

#### 既存モデルへの追加

FlyerDistributor モデル:
```prisma
model FlyerDistributor {
  // ... existing fields ...
  isTrainingTestPassed  Boolean   @default(false)   // 研修テスト合格フラグ
  trainingTestPassedAt  DateTime?                    // 合格日時
  testAssignments       TrainingTestAssignment[]
}
```

Employee モデル:
```prisma
model Employee {
  // ... existing fields ...
  testAssignments       TrainingTestAssignment[]  @relation("TestAssigner")
}
```

### 3.4 テスト設定（SystemSetting）

既存の SystemSetting テーブルを使用:

| キー | 説明 | デフォルト |
|---|---|---|
| `trainingTestQuestionCount` | 出題数 | `"10"` |
| `trainingTestPassingRate` | 合格率（%） | `"80"` |

### 3.5 管理者API

#### 問題プール管理

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/training-questions` | 問題一覧（isActive フィルタ、choices include） |
| `POST` | `/api/training-questions` | 問題作成（choices も一括作成） |
| `PUT` | `/api/training-questions/[id]` | 問題更新（choices も一括更新） |
| `DELETE` | `/api/training-questions/[id]` | 問題削除（論理削除: isActive=false） |

#### 画像付き問題の画像アップロード

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/training-questions/upload-image` | S3にアップロード |

- S3キー: `uploads/training-questions/{questionId}/{timestamp}.webp`

#### テスト割当

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/training-test-assignments` | テスト割当（body: `{ distributorId }`）。既にPENDINGの割当がある場合は400エラー。LINE通知を配布員に送信 |
| `GET` | `/api/training-test-assignments` | 割当一覧（distributorId, status フィルタ） |

#### テスト結果

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/training-test-results` | 結果一覧（distributorId, isPassed フィルタ） |
| `GET` | `/api/training-test-results/[id]` | 結果詳細（個別回答含む） |

### 3.6 配布員API

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/staff/training-test` | 自分に割当されたPENDINGテストの有無を確認 |
| `POST` | `/api/staff/training-test/start` | テスト開始。プールからランダムに10問選択。問題IDリストを返す（選択肢の順番もシャッフル）。TrainingTestResult レコード作成（attemptNumber自動カウント） |
| `POST` | `/api/staff/training-test/answer` | 1問回答（body: `{ resultId, questionId, choiceId }`）。レスポンス: isCorrect, correctChoiceId, explanation（即時フィードバック）。answers JSON に追記 |
| `POST` | `/api/staff/training-test/complete` | テスト完了。スコア集計、合格判定。合格時: assignment.status → PASSED, distributor.isTrainingTestPassed → true, 管理者通知作成。レスポンス: score, totalQuestions, isPassed |

### 3.7 配布員UI（`/staff/test`）

#### テスト一覧/開始画面
- PENDINGテストがある場合: 「テストを受験する」ボタン
- テストがない場合: 「現在テストはありません」表示
- 過去の結果一覧（スコア、合格/不合格、日時）

#### テスト受験画面
- 1問ずつ全画面表示
- プログレスバー（1/10, 2/10...）
- 問題文（配布員の言語で表示）
- 画像（IMAGE type の場合、タップで拡大）
- 選択肢ボタン（大きめのタップ領域、モバイル最適化）
- 回答後:
  - 正解 → 緑背景 + チェックマーク + 解説
  - 不正解 → 赤背景 + バツマーク + 正解表示 + 解説
  - 「次の問題へ」ボタン

#### 結果画面
- スコア表示（8/10 など）
- 合格: 「おめでとうございます！」+ 緑チェックマーク
- 不合格: 「もう一度挑戦してください」+ 「再受験する」ボタン
- 回答サマリー（各問題の正誤一覧）

#### レスポンシブデザイン
- **モバイル**: max-w-lg、大きなタップ領域、スクロール不要の1問1画面
- **タブレット**: 中央寄せ、やや大きめのカード
- **PC**: max-w-2xl、中央寄せ

### 3.8 管理者UI

#### `/settings` → 「研修テスト」タブ

**問題プール管理セクション:**
- 問題一覧テーブル: 問題文（先頭30文字）、種別バッジ、有効/無効、作成日
- 「問題追加」ボタン → 作成モーダル
  - 問題種別選択（4択/○×/画像付き）
  - 問題文（日本語/英語）
  - 画像アップロード（IMAGE typeの場合）
  - 選択肢入力（4択: 4つ、○×: 2つ固定）
  - 正解選択（ラジオボタン）
  - 解説入力（日本語/英語）
- 編集/削除ボタン

**テスト設定セクション:**
- 出題数（デフォルト10）
- 合格ライン（デフォルト80%）

**テスト結果セクション:**
- テーブル: 配布員名、スタッフID、スコア、合格/不合格バッジ、試行回数、受験日時
- フィルタ: 合格/不合格、日付範囲
- 詳細表示: 個別回答内容

#### 配布員管理画面からのテスト送信
- 配布員一覧の各行に「テスト送信」ボタン（またはアクションメニュー内）
- 既にPENDINGまたはPASSEDの場合はボタン無効化 + ステータス表示
- クリック → 確認ダイアログ → 割当作成 + LINE通知

### 3.9 LINE通知
- テスト割当時: 「研修テストが届きました。配布員ポータルから受験してください。」
- テストURL付き（`/staff/test`）

### 3.10 管理者通知
- 合格時: `AdminNotificationType` に `TRAINING_TEST_PASSED` を追加
- 通知ベルに表示: 「{配布員名}さんが研修テストに合格しました（スコア: 8/10）」

---

## 4. 初期データ（シード）

マニュアル内容に基づく20問の問題プールを初期シードで投入する。

### カテゴリ別問題数

| カテゴリ | 問題数 |
|---|---|
| 日常業務手順 | 4問 |
| 報酬体系 | 3問 |
| 報告・支払い | 3問 |
| 配布ルール | 7問 |
| 不正行為・コンプライアンス | 3問 |

### 問題例

**4択問題:**
- Q: "What time should you arrive at the office?" / 「何時までに事務所に到着すべきですか？」
  - A) 6am-9am B) 7am-10am (正解) C) 8am-11am D) 9am-12pm
  - 解説: "You should come to the office between 7am and 10am. If you will be later than 10am, contact by LINE."

**○×問題:**
- Q: "You can deliver flyers to a mailbox that has a 'No Flyer' sticker." / 「チラシお断りのステッカーがあるポストにチラシを配布してよい。」
  - 正解: False（×）
  - 解説: "Individual mailboxes with 'No Flyer' signs must be skipped."

**画像付き問題:**
- Q: "Can you deliver flyers to this mailbox?" / 「このポストにチラシを配布してよいですか？」
  - （管理室と書かれたポストの画像）
  - A) Yes B) No（正解）
  - 解説: "Mailboxes labeled '管理室' (Administrative Office) or '管理組合' must not receive flyers."

**引っかけ問題（重要）:**
- Q: "An apartment building has a sign saying 'チラシ禁止 警察に通報します' (No flyers, will call police). What should you do?"
  - A) Skip the building B) Deliver only to some mailboxes C) Deliver to all mailboxes（正解） D) Contact the office
  - 解説: "Although the sign says 'no flyers', distributing flyers is completely legal. Group posters saying 'no flyers' or 'will call police' can be ignored. Only skip buildings with signs mentioning '罰金' (fines), '着払い・返送' (return), or '広告主' (advertiser)."

---

## 5. ファイル構成

### 新規作成ファイル

```
prisma/schema.prisma                          # モデル追加

# マニュアル関連
src/app/api/training-manuals/upload/route.ts  # PDFアップロード
src/app/api/training-manuals/route.ts         # 一覧・削除
src/app/api/staff/training-manual/route.ts    # 配布員用マニュアル取得
src/app/staff/manual/page.tsx                 # マニュアル閲覧UI
src/app/staff/en/manual/page.tsx              # マニュアル閲覧UI（英語版ルート）

# テスト関連（管理者API）
src/app/api/training-questions/route.ts       # 問題CRUD
src/app/api/training-questions/[id]/route.ts  # 問題個別更新/削除
src/app/api/training-questions/upload-image/route.ts  # 画像アップロード
src/app/api/training-test-assignments/route.ts        # テスト割当
src/app/api/training-test-results/route.ts            # 結果一覧
src/app/api/training-test-results/[id]/route.ts       # 結果詳細

# テスト関連（配布員API）
src/app/api/staff/training-test/route.ts      # テスト状態確認
src/app/api/staff/training-test/start/route.ts    # テスト開始
src/app/api/staff/training-test/answer/route.ts   # 1問回答
src/app/api/staff/training-test/complete/route.ts # テスト完了

# テスト関連（配布員UI）
src/app/staff/test/page.tsx                   # テスト受験UI
src/app/staff/en/test/page.tsx                # テスト受験UI（英語版ルート）

# 管理者UI
src/components/settings/TrainingTestSettings.tsx  # 設定タブコンポーネント
src/components/settings/TrainingQuestionModal.tsx  # 問題作成/編集モーダル
src/components/settings/TrainingManualUpload.tsx   # マニュアルアップロード

# i18n
src/i18n/locales/ja/trainingTest.json
src/i18n/locales/en/trainingTest.json

# シード
scripts/seed-training-questions.ts            # 初期問題データ投入
```

### 修正ファイル

```
prisma/schema.prisma                          # 新モデル・enum追加
src/middleware.ts                             # /api/staff/training-* パス追加
src/app/settings/page.tsx                     # 「研修テスト」タブ追加
src/components/distributors/...               # テスト送信ボタン追加
src/lib/line.ts                              # テスト割当LINE通知追加
```

---

## 6. セキュリティ

| 対象 | 認証方式 | 備考 |
|---|---|---|
| マニュアルAPI | `pms_distributor_session` 認証必須 | |
| テスト受験API | `pms_distributor_session` 認証必須 | 自分宛の割当のみアクセス可 |
| 管理者API | `pms_session` 認証必須 | |
| テスト回答API | サーバー側で正解判定 | クライアントに正解情報を事前送信しない |
| 画像アップロード | S3 proxy URL経由 | 直接S3 URLを露出しない |

---

## 7. パフォーマンス考慮

- マニュアル画像: WebP形式で圧縮、CDN経由（S3 proxy）
- テスト問題: テスト開始時に10問分のみ取得（プール全体を送信しない）
- 回答API: 1問ずつの軽量リクエスト
- 画像付き問題: 遅延読み込み（表示する問題の画像のみ取得）
