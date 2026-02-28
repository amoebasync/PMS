# PMS Pro（ポスティング管理システム ＆ ECポータル）プロジェクト概要

本プロジェクトは、ポスティング事業・印刷手配を行う株式会社ティラミス向けの「社内向け基幹管理システム（PMS）」および「顧客向けECポータルサイト」を統合して提供する、フルスタックWebアプリケーションです。

## プロジェクト構成
- **言語**：TypeScript / JavaScript
- **フレームワーク**：Next.js (App Routerアーキテクチャ) / React
- **データベースORM**：Prisma
- **スタイリング**：Tailwind CSS
- **認証・認可**：NextAuth.js
- **その他主要技術**：
  - `fs/promises` 等を用いたローカルファイルアップロード・管理
  - RESTful API（Next.js Route Handlers `src/app/api/...` を利用）
  - メール送信機構（`src/lib/mailer.ts`）

## 主要ディレクトリ構成
フルスタックNext.jsアプリケーションとして、フロントエンド画面とバックエンドAPIが統合された構造を持っています。

- **`/src/app`** — ページ・ルーティング定義（Next.js App Router）
  - `/src/app/(auth)` — 社内管理者向けのログイン関連
  - `/src/app/portal` — **顧客向けECポータル**（トップページ、発注、マイページ、会員登録など）
  - `/src/app/api` — **バックエンドAPIエンドポイント**
    - `/api/portal/...` — ECポータル用API（ユーザー登録、発注処理など）
    - `/api/orders`, `/api/employees`, `/api/areas` 等 — 基幹システム用API
- **`/src/components`** — 再利用可能なReactコンポーネント
  - `/src/components/portal` — ECポータル専用の共通部品（Header, Footer, 規約等）
- **`/src/lib`** — 共通のユーティリティ関数や設定
  - `prisma.ts`（DB接続設定）、`mailer.ts`（メール送信）
- **`/prisma`** — データベース関連
  - `schema.prisma` — データベースのテーブル定義・リレーションモデル
- **`/public`** — 静的ファイル
  - `/logo` — 各種ロゴ画像
  - `/uploads/avatars` — ユーザーがアップロードした入稿データや画像ファイルの保存先

## 開発ガイドライン
- **アーキテクチャ**：Next.jsのApp Routerを採用。サーバーサイドレンダリング（RSC）とクライアントコンポーネント（`'use client'`）を適切に分離してパフォーマンスを最適化する。
- **データベース操作**：直接SQLは記述せず、必ず `Prisma Client` を介して型安全にアクセスする。トランザクション処理が必要な決済や発注処理には `prisma.$transaction` を使用する。
- **スタイリング**：Tailwind CSSのユーティリティクラスを用いて記述。レスポンシブデザイン（モバイル・PC対応）を前提とする。
- **コンポーネント化**：利用規約やプライバシーポリシーなど、複数箇所（ページ・モーダル）で利用するコンテンツはコンポーネント化し、保守性を高める。

## よく使うコマンド
```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動（ローカル環境）
npm run dev

# データベーススキーマの変更を反映（Prisma）
npx prisma db push
npx prisma generate

# データベースのGUIブラウザを起動（データ確認用）
npx prisma studio

# 本番環境向けのビルド
npm run build
npm start

## 監査ログ（Audit Log）機能

2026-02-26 実装済み。設計書: ~/Downloads/PMS_設計書/PMS_監査ログ機能_設計書.docx

### 概要
- DBテーブル: `audit_logs`（`prisma/schema.prisma` に `AuditLog` モデル）
- 共通ユーティリティ: `src/lib/audit.ts`
- 閲覧UI: `/audit-logs`（管理者のみ）
- 閲覧API: `GET /api/audit-logs`, `GET /api/audit-logs/[id]`

### 新しいAPIに監査ログを追加する手順
1. `import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';` を追加
2. 認証チェック後に `const { actorId, actorName } = await getAdminActorInfo();` を呼ぶ
3. UPDATE/DELETE の場合はトランザクション開始**前**に `findUnique` で `beforeData` を取得
4. メイン処理の後（または `prisma.$transaction` の `tx` コールバック内）で `writeAuditLog({ ..., tx })` を呼ぶ
5. 業務ログは `tx` を渡す（操作とログを同一トランザクションでコミット）
6. 認証ログは `tx` なし（ログ失敗でログイン処理を止めないため）

### センシティブフィールド除外
`sanitizeSnapshot()` が `passwordHash`, `token`, `accountNumber` 等を自動除外。
新しいセンシティブフィールドが増えた場合は `src/lib/audit.ts` の `SENSITIVE_FIELDS` マップに追記すること。

### 注意事項
- `beforeData`/`afterData` に `undefined` を渡すと Prisma の JSON 型でエラーになる。`null` の場合は `Prisma.JsonNull` を使う（`audit.ts` 内で処理済み）
- ログアウト処理では `getAdminActorInfo()` を Cookie 削除**前**に呼ぶこと
- 将来的にテーブルが肥大化するため、90日以前の定期削除ジョブの追加を検討する

## 応募者管理・面接日程調整機能

2026-02-27 実装済み。設計書: ~/Downloads/PMS_設計書/PMS_応募者管理機能_設計書.docx

### 概要
- 応募者テーブル: `applicants`、面接スロットテーブル: `interview_slots`、職種マスタ: `job_categories`
- 公開フォーム: `/apply`（認証不要、ja/en対応）
- 管理者画面: `/applicants`（FullCalendarカレンダー + 一覧 + 評価モーダル）
- Enum: `ApplicantFlowStatus`（INTERVIEW_WAITING / TRAINING_WAITING / TRAINING_COMPLETED）
- Enum: `ApplicantHiringStatus`（IN_PROGRESS / HIRED / REJECTED）
- メール: `sendApplicantConfirmationEmail`（面接確認）、`sendHiringNotificationEmail`（採用通知）
- 監査ログ: 応募・スロット作成/削除・評価更新・ステータス変更の全操作を記録

### 公開API（認証不要）
- `GET /api/interview-slots/available` — 空きスロット一覧
- `POST /api/apply` — 応募送信（トランザクション処理、recruitingMediaId対応）
- `GET /api/job-categories/public`, `GET /api/countries/public`, `GET /api/visa-types/public` — マスタ参照
- `GET /api/recruiting-media/public?code=xxx` — 求人媒体コード→ID解決

### 管理者API（pms_session必須）
- `GET/POST /api/interview-slots` — スロット一覧・一括作成
- `DELETE /api/interview-slots/[id]` — スロット削除
- `GET /api/applicants`, `GET/PUT /api/applicants/[id]` — 応募者一覧・詳細・更新
- `POST /api/applicants/[id]/cancel-interview` — 面接キャンセル（スロット解放）
- `POST /api/applicants/[id]/reschedule` — 面接日程変更
- `GET/POST/PUT/DELETE /api/recruiting-media` — 求人媒体マスタCRUD

## 求人媒体トラッキング機能（2026-02-28 追加）

### 概要
応募フォーム（`/apply`）のURLパラメータ `?source=xxx` で求人媒体を自動追跡する。
管理者は `/settings` で求人媒体マスタを管理し、`/applicants` の評価モーダルで応募経路を確認・変更できる。

### データモデル
- `recruiting_media` テーブル: `id`, `nameJa`, `nameEn`, `code`（URLパラメータ値、unique）, `isActive`, `sortOrder`
- `applicants.recruiting_media_id`: nullable FK で求人媒体を紐付け

### 使い方
1. `/settings` → 求人媒体タブで媒体を登録（例: code=`indeed`, nameJa=`Indeed`）
2. 応募フォームのURLに `?source=indeed` を付与して求人広告に掲載
3. 応募者がそのURLからアクセスすると、自動的に `recruitingMediaId` が保存される
4. `/applicants` の評価モーダルで「応募経路」ドロップダウンから確認・変更可能

### API
- `GET/POST/PUT/DELETE /api/recruiting-media` — 管理者CRUD（pms_session必須）
- `GET /api/recruiting-media/public?code=xxx` — 公開API（code→ID解決）

### 注意事項
- 応募フォームのUIには媒体選択欄は表示しない（URLパラメータのみで裏側追跡）
- `src/middleware.ts` に `/api/recruiting-media/public` を公開パスとして追加済み
- `code` は自動的に小文字に正規化される

## 国名エイリアス機能（2026-02-28 追加）

### 概要
国マスタに別名（aliases）フィールドを追加し、応募フォームの国検索で日本語・英語・通称すべてでマッチするようにした。

### データモデル
- `countries.aliases`: TEXT型、カンマ区切りで複数の別名を格納
  - 例: 韓国 → `"韓国,大韓民国,Republic of Korea,South Korea"`

### 初期データ投入
```bash
npx tsx scripts/seed-country-aliases.ts
```
34カ国の別名を一括登録する。既にエイリアスが設定済みの国はスキップ。

### 管理
- `/settings` → 国籍タブの作成/編集モーダルに「別名（エイリアス）」テキスト入力欄
- プレースホルダー: `韓国,大韓民国,Korea (カンマ区切り)`

### 検索ロジック（`/apply` の国選択）
SearchableSelect の `filterFn` で以下の順にマッチ:
1. `country.name`（日本語名）
2. `country.nameEn`（英語名）
3. `country.aliases`（別名、カンマ区切りを分割して各要素と照合）

## 管理者面接キャンセル・日程変更機能（2026-02-28 追加）

### 概要
管理者が `/applicants` の評価モーダルから応募者の面接をキャンセルまたは日程変更できる。

### API
- `POST /api/applicants/[id]/cancel-interview` — 面接キャンセル（スロット解放、ステータスは変更しない）
- `POST /api/applicants/[id]/reschedule` body: `{ newSlotId }` — 面接日程変更（旧スロット解放+新スロット予約+Google Meet自動生成）

### UI（`/applicants` 評価モーダル）
- 面接情報の横に「日程変更」「面接キャンセル」ボタン
- 日程変更: パネルが開き、空きスロット一覧から新しい日程を選択
- キャンセル: 確認ダイアログ後に実行
- 評価スケール（ScoreSelector）: 低/高ラベル付き、1-2=赤、3=黄、4-5=緑のカラーコーディング

## クレーム管理・配布禁止物件DB（2026-02-28 実装済み）

設計書: ~/Downloads/PMS_設計書/PMS_クレーム管理・配布禁止物件_設計書.docx

### 概要
- クレーム発生時に物件を配布禁止として登録し、今後の配布で誤配を防止
- 既存CSVデータ（約2万件）のインポート対応
- クレームから禁止物件への自動登録フロー
- 物件写真のS3アップロード
- ポリラインからGeoJSONへの変換（地図表示用）

### DB
- Enum: `ComplaintStatus`（UNRESOLVED / IN_PROGRESS / RESOLVED）
- テーブル: `prohibited_reasons`（禁止理由マスタ）、`complaint_types`（クレーム種別マスタ）
- テーブル: `prohibited_properties`（配布禁止物件）、`complaints`（クレーム）、`complaint_responses`（対応履歴）

### 公開パス
なし（全API管理者認証必須）

### 管理者API（pms_session必須）
- `GET/POST/PUT/DELETE /api/prohibited-reasons` — 禁止理由マスタ CRUD
- `GET/POST/PUT/DELETE /api/complaint-types` — クレーム種別マスタ CRUD
- `GET/POST/PUT/DELETE /api/prohibited-properties` — 禁止物件 CRUD（DELETEは論理削除）
- `GET/PUT /api/prohibited-properties/[id]` — 禁止物件 詳細・更新
- `POST/DELETE /api/prohibited-properties/[id]/images` — 画像アップロード（S3）
- `POST /api/prohibited-properties/import` — CSVインポート（polylineデコード含む）
- `GET /api/prohibited-properties/map` — 地図用データ取得
- `GET/POST /api/complaints` — クレーム一覧・作成
- `GET/PUT /api/complaints/[id]` — クレーム詳細・更新
- `GET/POST /api/complaints/[id]/responses` — 対応履歴
- `POST /api/complaints/[id]/register-prohibited` — クレーム→禁止物件登録
- `POST/DELETE /api/complaints/[id]/images` — クレーム画像

### フロントエンド
- `/quality/complaints` — クレーム管理（一覧 + 詳細モーダル + 対応履歴 + 禁止物件登録）
- `/quality/prohibited-properties` — 配布禁止物件（一覧 + 地図 + CSVインポート）
- `/settings` — 禁止理由タブ + クレーム種別タブ
- サイドバー: QUALITYグループ（クレーム管理、配布禁止物件）
- ダッシュボード: 未対応クレームアラートカード

### CSVインポート
- `@mapbox/polyline` でサーバーサイドポリラインデコード
- CLIENT_CD空欄 = 全顧客対象の完全禁止（customerId: null）
- ADDRESS_CDからArea/Prefecture/City を自動解決
- 画像はS3の `uploads/prohibited-properties/{id}/` に保存

## 設計書について

- 設計書の格納先: `~/Downloads/PMS_設計書/`
- docxファイルの読み書きには `python-docx`（`import docx`）を使用する
- 設計書生成スクリプト例: `scripts/generate_applicant_docs.py`
- 機能一覧: `~/Downloads/PMS_設計書/PMS_機能一覧.docx` — 新機能追加時はセクション追加すること

## タスク管理（ATF Kanban）

このプロジェクトのタスクは **ATF Kanban**（`http://localhost:3002`）で管理する。
MCPサーバー `atf-kanban` が利用可能。プロジェクト名: **PMS開発**

### 開発ワークフロー

```
① ユーザーがかんばんUIでチケットをバックログに登録
        ↓
② PM エージェントがバックログを分析
        ↓
③ 【Q&Aループ】PM が不明点をユーザーに質問
        ↓
   ユーザーが回答
        ↓
   PMがまだ疑問点があれば → ③に戻って再質問
   全ての疑問点が解消されたら → ④へ
        ↓
④ PM がスプリント計画を提示
        ↓
   ユーザーが承認 → ⑤へ
   ユーザーが却下（修正依頼） → ④に戻って計画を修正して再提示
        ↓
⑤ 開発エージェントが並列実装（backend / frontend）
        ↓
⑥ レビューエージェントがバグチェック・修正
        ↓
⑦ ドキュメントエージェントが CLAUDE.md・設計書を更新
        ↓
⑧ 全チケット done/blocked → complete_pm_session を呼び出して終了
```

### PM エージェントの詳細フロー（MCP ツール使用手順）

PM として動作する場合、**必ず以下の手順に従うこと**：

**Phase 0: コードベース・実装済み内容の把握（必須・最初に必ず実行）**

バックログを分析する前に、必ず現在のプロジェクト状態を把握すること。

1. **直近の実装内容を確認する**
   - `git log --oneline -20` でここ最近のコミット履歴を確認
   - `git diff HEAD~5 --stat` で変更されたファイルを把握

2. **既存チケットの状態を確認する**
   - `mcp__atf-kanban__list_tickets` で **status=done** のチケットを確認し、何が実装済みかを把握
   - `mcp__atf-kanban__list_tickets` で **status=in_progress** のチケットも確認（進行中の作業と重複しないか）

3. **コードベースの現状を把握する**
   - `cat prisma/schema.prisma` で現在のDBスキーマ・モデル定義を確認
   - `ls src/app/api/` でどのAPIエンドポイントが既に存在するかを確認
   - `ls src/app/` でページ構成を確認
   - バックログのチケット内容に関連する既存ファイルがあれば内容も確認する

4. **CLAUDE.md の「実装済み」セクションを再確認する**
   - 本ファイルに記載の実装済み機能（監査ログ、応募者管理、Google Meet等）を念頭に置く

⚠️ **この Phase 0 を省略して Phase 1 に進んではいけない。** 既存コードを理解せずに計画を立てると、重複実装・既存機能との矛盾・アーキテクチャの不統一が生じる。

**Phase 1: バックログ確認**
- `mcp__atf-kanban__list_tickets` で status=backlog のチケットを確認する
- Phase 0 で把握した実装済み内容と照らし合わせ、本当に新規実装が必要なものだけを対象にする
- バックログが空の場合は `mcp__atf-kanban__complete_pm_session` を呼び出して即終了する

**Phase 2: Q&A フェーズ（複数ラウンド必須）**
- `mcp__atf-kanban__post_pm_questions` で疑問点を質問する
- `mcp__atf-kanban__wait_for_questions_answer` でユーザーの回答を待機する
- 回答を受け取ったら内容を分析し、**まだ不明点・疑問点が残っている場合は必ず再度 `post_pm_questions` を呼んで追加質問する**
- ⚠️ **回答を受け取ってもまだ理解が不十分な場合は、絶対に次のフェーズ（計画作成）に進んではいけない**
- 全ての疑問点が完全に解消されてから Phase 3 に進む

**Phase 3: スプリント計画フェーズ**
- `mcp__atf-kanban__post_sprint_plan` でスプリント計画を投稿する
- `mcp__atf-kanban__wait_for_sprint_approval` でユーザーの承認を待機する
- 却下された場合はフィードバックを元に計画を修正して再投稿する（Phase 3 を繰り返す）

**Phase 4: 実装フェーズ**
- 承認後、サブエージェントを起動して並列実装させる
- 各サブエージェントに `add_activity_log` で節目ごとの進捗を記録させる

**Phase 5: 完了フェーズ（必ずここで終了すること）**
- 全チケットが done/blocked になったら `mcp__atf-kanban__complete_pm_session` を呼び出す
- ⚠️ **`complete_pm_session` を呼んだら、そこで処理を完全に終了する**
- ⚠️ **完了後に再度バックログを確認したり、Q&A フェーズを再開してはいけない**
- ⚠️ **1回の PM 起動 = 1スプリント分の作業。完了したら次の起動を待つ**

### PM エージェントの起動方法

```bash
cd ~/PMS && claude
# 起動後に入力：
> バックログのチケットをPMとして処理して
```

または subagent として呼び出し：
```
Use the pm-agent subagent to process the backlog
```

**PM エージェントは必ずユーザーの承認を得てから実装を開始する。**

### エージェントの作業フロー（各エージェント共通）
1. `mcp__atf-kanban__register_agent` で自分を登録
2. `mcp__atf-kanban__claim_ticket` でチケットを担当宣言（status: in_progress）
3. 実装・作業を進める
4. `mcp__atf-kanban__add_activity_log` で節目ごとに進捗をログ（**必須・省略禁止**）
   - 作業開始時: `log_type: "progress"`, message: "作業開始: [何をするか]"
   - 中間報告 (30分毎 or 主要ステップ完了時): `log_type: "progress"`, message: "[完了したこと]"
   - エラー発生時: `log_type: "error"`, message: "[エラー内容と対処]"
   - 完了直前: `log_type: "completion"`, message: "[実装した内容のサマリー]"
   - ⚠️ `complete_ticket` を呼ぶ前に必ず少なくとも1回は `add_activity_log` を呼ぶこと
5. **実装中に仕様や要件が不明な場合は `mcp__atf-kanban__wait_for_pm_response` でユーザーに質問する（下記参照）**
6. `mcp__atf-kanban__complete_ticket` で完了報告
7. ブロック時は `mcp__atf-kanban__block_ticket` で理由を記録

### エージェントの質問フロー（実装中に不明点がある場合）

実装を進める中で仕様が不明な場合は、`block_ticket` で止まらずに **`wait_for_pm_response` で質問する**こと。

```
mcp__atf-kanban__wait_for_pm_response({
  ticket_id:  "チケットのUUID",
  question:   "ログイン後のリダイレクト先はダッシュボード（/dashboard）でよいですか？それとも前のページに戻りますか？",
  agent_name: "backend-agent-1"
})
```

**動作の流れ：**
1. 質問がかんばんUIのアクティビティログに紫色 `?` で表示される
2. チケットに `awaiting_pm` タグが付き、UIに返答フォームが現れる
3. ユーザーが返答フォームに入力して送信
4. `wait_for_pm_response` が回答テキストを返す → 実装を再開

**注意事項：**
- 質問後は回答が来るまでそのままポーリング待機する（プロセスを終了しないこと）
- 同じチケットに対して複数回質問することも可能（都度 `wait_for_pm_response` を呼ぶ）
- タイムアウト（デフォルト 600 秒）した場合は `timed_out: true` が返るので、その場合は `block_ticket` でブロック状態にして理由を記録すること

### かんばんUI
`http://localhost:3002` でリアルタイムに進捗を視覚確認できる（要起動: `cd ~/AI_TaskForce/kanban-ui && pnpm dev`）

## ロゴ画像使用ガイドライン

`/public/logo/` に複数種類のロゴファイルがある。背景色に応じて使い分けること。

| ファイル名 | 用途 |
|---|---|
| `logo_light.png` | 明るい背景（白・グレー系）のページ |
| `logo_light_transparent.png` | 明るい背景（背景透過） — `/apply` などの白系ページはこれを使用 |
| `logo_dark.png` | 暗い背景のページ |
| `logo_dark_transparent.png` | 暗い背景（背景透過） |
| `logo_Icon_transparent.png` | アイコンのみ（ファビコン等） |
| `logo_SNS.png` | SNS共有用 |

### 注意事項
- 白・グレー背景のページ（例: `/apply`）では `logo_light_transparent.png` を使用する
- 暗い背景のページでは `logo_dark_transparent.png` を使用する
- 2026-02-27 に `/apply` ページのロゴを `logo_dark_transparent.png` から `logo_light_transparent.png` に修正済み

## Google Meet 自動作成機能

2026-02-27 実装済み。

### 概要
応募者が `/apply` から応募した際に、Google Calendar API を使用して Google Meet リンク付きの予定を自動作成する。

### 必要な環境変数
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx
```

### セットアップ手順
1. Google Cloud Console でプロジェクトを作成
2. Google Calendar API を有効化
3. OAuth 2.0 認証情報を作成（Webアプリケーション）
4. OAuth同意画面で必要なスコープを追加:
   - `https://www.googleapis.com/auth/calendar.events`
5. [OAuth Playground](https://developers.google.com/oauthplayground) でリフレッシュトークンを取得
6. `.env` に上記の環境変数を追加

### 処理フロー
1. 応募者が `/apply` フォームを送信
2. `POST /api/apply` が呼ばれる
3. 環境変数が設定されていれば `createGoogleMeetEvent()` を呼び出し
4. Google Calendar にイベント + Meet リンクを作成
5. `interview_slots.meet_url` に Meet URL を保存
6. 確認メールに Meet URL を含めて送信

### ユーティリティ
- `src/lib/google-meet.ts` - Google Meet 作成関数
- `isGoogleMeetConfigured()` - 環境変数が設定されているかチェック
- `createGoogleMeetEvent()` - Meet リンク付きイベントを作成

### 注意事項
- 環境変数が設定されていない場合、Meet 作成はスキップされる（エラーにはならない）
- スロットに既に `meetUrl` が設定されている場合は上書きしない
- リフレッシュトークンは長期間有効だが、Google アカウントのパスワード変更などで無効になる場合がある

## 面接スロットの職種対応（2026-02-27 追加）

### 概要
面接スロットに職種ID（`jobCategoryId`）を追加し、職種別または全職種対応のスロットを作成可能にした。

### データモデル変更
- `InterviewSlot.jobCategoryId` (nullable): 特定職種用のスロット（nullの場合は全職種対応）
- `JobCategory.interviewSlots`: 逆参照リレーション

### UI変更
- `/settings` 面接スロットタブ: 「面接スロットマスタ」セクションで個別スロットを追加可能
  - 日付、開始時刻、終了時刻、対象職種（または全職種）を指定
  - コンポーネント: `src/components/settings/InterviewSlotManager.tsx`
- `/apply` 応募フォーム: 職種選択後、その職種用 + 全職種対応のスロットのみを表示

### API変更
- `GET /api/interview-slots`: `jobCategoryId` パラメータでフィルタ可能
- `POST /api/interview-slots`: `jobCategoryId` パラメータで職種指定可能
- `GET /api/interview-slots/available`: `jobCategoryId` パラメータで職種フィルタ（その職種 OR 全職種対応を返す）

## CRM タスク機能改修（定期タスク自動生成 & 柔軟な担当者アサイン）

2026-02-27 実装済み。設計書: ~/Downloads/PMS_設計書/PMS_CRMタスク機能改修_設計書.docx

### 概要
- 定期タスクテンプレートから自動タスク生成（CRON: 毎日00:00）
- 担当者を社員個人・部署・支店単位で柔軟にアサイン可能
- タスクカテゴリ（営業/現場/アドミン）による分類と関連先UIの出し分け
- Enum: `TaskCategory`（SALES/FIELD/ADMIN）、`RecurrenceType`（ONCE/DAILY/WEEKLY/MONTHLY/YEARLY）、`TaskCompletionRule`（SHARED/INDIVIDUAL）
- DB: `task_assignees`（中間テーブル）、`task_templates`（定期タスクマスタ）、`tasks` に category/branch_id/schedule_id/template_id 追加

### API（管理者 pms_session 必須）
- `GET /api/search-assignees?q=keyword` — 社員・部署・支店を横断検索
- `GET/POST /api/task-templates` — テンプレート一覧・作成
- `GET/PUT/DELETE /api/task-templates/[id]` — テンプレート詳細・更新・削除
- `GET /api/tasks` — category, myTasks フィルタ追加、assignees include 追加
- `POST /api/tasks`, `PUT /api/tasks/[id]` — category, assignees 対応追加

### CRON API（Bearer CRON_SECRET 認証）
- `GET /api/cron/generate-tasks` — テンプレートに基づきタスクを自動生成
  - SHARED: 1タスク + 複数 TaskAssignee
  - INDIVIDUAL: 部署/支店→社員展開 → 人数分の個別タスク生成
  - 重複防止: 同日・同テンプレートからの二重生成チェック

### フロントエンド
- `/crm/tasks` にタブ追加（タスク一覧 / 定期タスク設定）
- 担当者マルチセレクト UI（AssigneeMultiSelect コンポーネント）
- カテゴリバッジ表示、マイタスクフィルタ
- テンプレート CRUD モーダル（サイクル設定UI: 曜日ボタン/日付/月日セレクト）

### CRON 登録（CodeDeploy）
- `scripts/after_install.sh` に登録（重複チェック付き）
- 面接スロット生成: 毎日01:00 → `/api/cron/generate-slots`
- 定期タスク生成: 毎日00:00 → `/api/cron/generate-tasks`

### 注意事項
- `src/middleware.ts` に `/api/cron/generate-tasks` を公開パスとして追加済み
- テンプレートの targetEmployeeIds/targetDepartmentIds/targetBranchIds は JSON 配列として保存
- CRON_SECRET 環境変数が必要（`.env` に設定済み）

## GPSトラッキング＆軌跡ビューア機能

2026-03-01 実装済み。

### 概要
配布員がモバイルアプリで配布作業を行う際のGPS位置情報をリアルタイムで記録し、管理者がスケジュール画面から配布軌跡を地図上で確認できる機能。
- 配布員のライフサイクル: START → GPS送信（10秒間隔） → 進捗報告（500枚ごと） → スキップ記録 → FINISH
- START時に `DistributionSchedule.status` → `DISTRIBUTING` に変更
- FINISH時に `DistributionItem.actualCount` を更新 + `DistributionSchedule.status` → `COMPLETED`
- START/FINISH時に管理者通知を作成（ポーリング方式 + ブラウザOS通知）

### DB（Prisma スキーマ）
- Enum: `IncompleteReason`（AREA_DONE / GIVE_UP / OTHER）
- Enum: `AdminNotificationType`（DISTRIBUTION_START / DISTRIBUTION_FINISH）
- `ScheduleStatus` に `DISTRIBUTING` を追加（UNSTARTED → IN_PROGRESS → DISTRIBUTING → COMPLETED）
- テーブル: `distribution_sessions`（配布セッション、1スケジュール=1セッション）
- テーブル: `gps_points`（GPS座標、10秒ごと、高頻度）
- テーブル: `progress_events`（進捗報告、500枚ごと）
- テーブル: `skip_events`（配布禁止物件スキップ記録）
- テーブル: `admin_notifications`（管理者通知）

### スタッフAPI（モバイルアプリ向け、pms_distributor_session認証）
- `GET /api/staff/config` — GPS送信間隔・進捗マイルストーン取得（SystemSettingから）
- `POST /api/staff/distribution/start` — 配布開始（セッション作成 + status→DISTRIBUTING + 初回GPS + 通知）
- `POST /api/staff/distribution/gps` — GPS座標受信（⚡高頻度・最軽量設計、監査ログなし）
- `POST /api/staff/distribution/progress` — 進捗マイルストーン報告
- `POST /api/staff/distribution/skip` — 禁止物件スキップ記録
- `POST /api/staff/distribution/finish` — 配布終了（actualCount更新 + status→COMPLETED + 通知 + 報酬計算）
- `GET /api/staff/distribution/earnings` — 当日報酬表示

### 管理者API（pms_session認証）
- `GET /api/schedules/[id]/trajectory` — 軌跡データ全取得（GPS・進捗・スキップ・エリアGeoJSON・禁止物件）
- `GET /api/schedules/[id]/trajectory/latest` — リアルタイム最新座標（ポーリング用）
- `GET /api/admin/notifications` — 通知一覧（unreadOnly, limit, sinceIdフィルタ）
- `PUT /api/admin/notifications/read` — 通知既読（ids指定 or all:true）

### フロントエンド
- `src/components/schedules/TrajectoryViewer.tsx` — GPS軌跡ビューアモーダル
  - Google Maps上にエリアポリゴン、GPS軌跡ポリライン、進捗/スキップ/禁止物件マーカーを表示
  - タイムスライダー＆再生アニメーション（1x/2x/5x/10x速度）
  - パフォーマンス統計パネル（歩数・距離・カロリー・時間あたりメトリクス）
  - アクティブセッション時は15秒ポーリングでリアルタイム更新
- `src/components/NotificationBell.tsx` — 通知ベルコンポーネント
  - 30秒ポーリングで未読通知を取得、バッジ表示
  - ブラウザNotification APIでOS通知
  - 通知クリックで該当スケジュールの軌跡ビューアを開く
- `/schedules` ページ: GPSボタンの色分け（灰=未開始、緑点滅=配布中、青=完了）
- `/settings` ページ: GPS設定セクション（送信間隔・進捗マイルストーン）
- `LayoutWrapper.tsx`: ヘッダーにNotificationBell配置

### 報酬計算ロジック
```
unitPrice = baseRate(rate1Type〜rate6Type) + areaUnitPrice + sizeUnitPrice
earnedAmount = floor(unitPrice × max(actualCounts))
```
`distributor-payroll/generate/route.ts` と同じロジックを `finish/route.ts` 内で再利用。

### データ量見積もり
- 10秒間隔 × 8時間 = 約2,880ポイント/セッション
- 50人/日 × 2,880 = 約14.4万行/日（gps_points）
- 90日以上のデータはアーカイブ/削除を検討

### SystemSetting キー
- `gpsTrackingInterval`: GPS送信間隔（秒）、デフォルト "10"
- `progressMilestone`: 進捗マイルストーン（枚）、デフォルト "500"
