#!/bin/bash
cd /home/ec2-user/pms_java
export PATH=$PATH:/home/ec2-user/.nvm/versions/node/v20.20.0/bin
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --accept-data-loss
pm2 restart pms

# --- 面接スロット自動生成 CRON 登録（重複時はスキップ） ---
CRON_SECRET=$(grep '^CRON_SECRET=' .env | cut -d'=' -f2-)
if [ -n "$CRON_SECRET" ]; then
  CRON_JOB="0 1 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" https://pms.tiramis.co.jp/api/cron/generate-slots >> /tmp/pms-cron-generate-slots.log 2>&1"
  # 既に同じCRONが登録されていなければ追加
  if ! crontab -l 2>/dev/null | grep -q "generate-slots"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "CRON登録: 面接スロット自動生成（毎日01:00）"
  else
    echo "CRON既存: 面接スロット自動生成（スキップ）"
  fi

  # --- 定期タスク自動生成 CRON 登録（重複時はスキップ） ---
  TASK_CRON_JOB="0 0 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" https://pms.tiramis.co.jp/api/cron/generate-tasks >> /tmp/pms-cron-generate-tasks.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "generate-tasks"; then
    (crontab -l 2>/dev/null; echo "$TASK_CRON_JOB") | crontab -
    echo "CRON登録: 定期タスク自動生成（毎日00:00）"
  else
    echo "CRON既存: 定期タスク自動生成（スキップ）"
  fi
fi
