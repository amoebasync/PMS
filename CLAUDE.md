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
