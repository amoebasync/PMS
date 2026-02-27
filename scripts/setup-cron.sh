#!/bin/bash
# 面接スロット自動生成CRONの設定スクリプト
# 使い方: bash scripts/setup-cron.sh [dev|prod]

set -e

ENV="${1:-dev}"

# .env から CRON_SECRET を読み取る
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env ファイルが見つかりません: $ENV_FILE"
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: .env に CRON_SECRET が設定されていません"
  exit 1
fi

# 環境ごとのURL設定
if [ "$ENV" = "prod" ]; then
  API_URL="https://pms.tiramis.co.jp/api/cron/generate-slots"
  echo "=== 本番環境用CRONを設定します ==="
elif [ "$ENV" = "dev" ]; then
  API_URL="http://localhost:3000/api/cron/generate-slots"
  echo "=== 開発環境用CRONを設定します ==="
else
  echo "ERROR: 引数は 'dev' または 'prod' を指定してください"
  echo "  bash scripts/setup-cron.sh dev   # 開発環境"
  echo "  bash scripts/setup-cron.sh prod  # 本番環境"
  exit 1
fi

# CRONジョブの内容
CRON_JOB="0 1 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" $API_URL >> /tmp/pms-cron-generate-slots.log 2>&1"

# 既存のPMS CRONを削除して再登録
(crontab -l 2>/dev/null | grep -v "generate-slots" ; echo "$CRON_JOB") | crontab -

echo ""
echo "CRON登録完了:"
echo "  時刻: 毎日 01:00"
echo "  URL:  $API_URL"
echo "  ログ: /tmp/pms-cron-generate-slots.log"
echo ""
echo "確認: crontab -l"
crontab -l | grep "generate-slots"
