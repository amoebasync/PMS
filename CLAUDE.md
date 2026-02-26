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
- `POST /api/apply` — 応募送信（トランザクション処理）
- `GET /api/job-categories/public`, `GET /api/countries/public`, `GET /api/visa-types/public` — マスタ参照

### 管理者API（pms_session必須）
- `GET/POST /api/interview-slots` — スロット一覧・一括作成
- `DELETE /api/interview-slots/[id]` — スロット削除
- `GET /api/applicants`, `GET/PUT /api/applicants/[id]` — 応募者一覧・詳細・更新

## 設計書について

- 設計書の格納先: `~/Downloads/PMS_設計書/`
- docxファイルの読み書きには `python-docx`（`import docx`）を使用する
- 設計書生成スクリプト例: `scripts/generate_applicant_docs.py`
- 機能一覧: `~/Downloads/PMS_設計書/PMS_機能一覧.docx` — 新機能追加時はセクション追加すること
