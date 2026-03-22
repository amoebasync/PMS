#!/bin/bash
cd /home/ec2-user/pms_java
export PATH=$PATH:/home/ec2-user/.nvm/versions/node/v20.20.0/bin
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
# PM2 cluster mode（2プロセス）で起動
pm2 describe pms > /dev/null 2>&1 && pm2 delete pms
pm2 start ecosystem.config.js
pm2 save

# --- crond が未インストールならインストール ---
if ! command -v crontab &> /dev/null; then
  sudo yum install -y cronie
  sudo systemctl enable crond
  sudo systemctl start crond
  echo "crond をインストール・起動しました"
fi

# --- 面接スロット自動生成 CRON 登録（重複時はスキップ） ---
CRON_SECRET=$(grep '^CRON_SECRET=' .env | cut -d'=' -f2-)
if [ -n "$CRON_SECRET" ]; then
  CRON_JOB="0 15 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/generate-slots >> /tmp/pms-cron-generate-slots.log 2>&1"
  # 既に同じCRONが登録されていなければ追加
  if ! crontab -l 2>/dev/null | grep -q "generate-slots"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "CRON登録: 面接スロット自動生成（毎日01:00）"
  else
    echo "CRON既存: 面接スロット自動生成（スキップ）"
  fi

  # --- 定期タスク自動生成 CRON 登録（重複時はスキップ） ---
  TASK_CRON_JOB="0 15 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/generate-tasks >> /tmp/pms-cron-generate-tasks.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "generate-tasks"; then
    (crontab -l 2>/dev/null; echo "$TASK_CRON_JOB") | crontab -
    echo "CRON登録: 定期タスク自動生成（毎日00:00）"
  else
    echo "CRON既存: 定期タスク自動生成（スキップ）"
  fi

  # --- 研修スロット自動生成 CRON 登録（重複時はスキップ） ---
  TRAINING_CRON_JOB="0 15 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/generate-training-slots >> /tmp/pms-cron-generate-training-slots.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "generate-training-slots"; then
    (crontab -l 2>/dev/null; echo "$TRAINING_CRON_JOB") | crontab -
    echo "CRON登録: 研修スロット自動生成（毎日02:00）"
  else
    echo "CRON既存: 研修スロット自動生成（スキップ）"
  fi

  # --- 配布員評価 CRON 登録（重複時はスキップ） ---
  EVAL_CRON_JOB="0 18 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/evaluate-distributors >> /tmp/pms-cron-evaluate-distributors.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "evaluate-distributors"; then
    (crontab -l 2>/dev/null; echo "$EVAL_CRON_JOB") | crontab -
    echo "CRON登録: 配布員評価（毎日03:00 JST）"
  else
    echo "CRON既存: 配布員評価（スキップ）"
  fi

  # --- ビザ期限チェック CRON 登録（重複時はスキップ） ---
  VISA_CRON_JOB="0 15 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/check-visa-expiry >> /tmp/pms-cron-check-visa-expiry.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "check-visa-expiry"; then
    (crontab -l 2>/dev/null; echo "$VISA_CRON_JOB") | crontab -
    echo "CRON登録: ビザ期限チェック（毎日03:30）"
  else
    echo "CRON既存: ビザ期限チェック（スキップ）"
  fi

  # --- アラート定義チェック CRON 登録（重複時はスキップ） ---
  ALERT_CRON_JOB="0 15 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/check-alert-definitions >> /tmp/pms-cron-check-alert-definitions.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "check-alert-definitions"; then
    (crontab -l 2>/dev/null; echo "$ALERT_CRON_JOB") | crontab -
    echo "CRON登録: アラート定義チェック（毎日21:00 UTC = 06:00 JST）"
  else
    echo "CRON既存: アラート定義チェック（スキップ）"
  fi

  # --- 面接・研修リマインダーメール CRON 登録（重複時はスキップ） ---
  REMINDER_CRON_JOB="0 0 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/send-reminders >> /tmp/pms-cron-send-reminders.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "send-reminders"; then
    (crontab -l 2>/dev/null; echo "$REMINDER_CRON_JOB") | crontab -
    echo "CRON登録: 面接・研修リマインダーメール（毎日09:00 JST）"
  else
    echo "CRON既存: 面接・研修リマインダーメール（スキップ）"
  fi

  # --- 出勤確認LINE送信 CRON 登録（重複時はスキップ） ---
  # 毎朝6:00 JST = UTC 21:00前日
  ATTENDANCE_CRON_JOB="0 21 * * * curl -s -X POST -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/send-attendance-check >> /tmp/pms-cron-send-attendance-check.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "send-attendance-check"; then
    (crontab -l 2>/dev/null; echo "$ATTENDANCE_CRON_JOB") | crontab -
    echo "CRON登録: 出勤確認LINE送信（毎日06:00 JST）"
  else
    echo "CRON既存: 出勤確認LINE送信（スキップ）"
  fi

  # --- PS不正検知分析 CRON 登録（重複時はスキップ） ---
  # 毎日05:00 JST = UTC 20:00（前日分を分析）
  PS_FRAUD_CRON_JOB="0 20 * * * curl -s -X POST -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/analyze-ps-fraud >> /tmp/pms-cron-analyze-ps-fraud.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "analyze-ps-fraud"; then
    (crontab -l 2>/dev/null; echo "$PS_FRAUD_CRON_JOB") | crontab -
    echo "CRON登録: PS不正検知分析（毎日05:00 JST）"
  else
    echo "CRON既存: PS不正検知分析（スキップ）"
  fi

  # --- ハウスキープ CRON 登録（重複時はスキップ） ---
  # 処理: admin_notifications(30日超削除) / audit_logs(90日超S3アーカイブ) / gps_points(365日超S3アーカイブ)
  HOUSEKEEP_CRON_JOB="0 15 * * * curl -s -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/housekeep >> /tmp/pms-cron-housekeep.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "housekeep"; then
    (crontab -l 2>/dev/null; echo "$HOUSEKEEP_CRON_JOB") | crontab -
    echo "CRON登録: ハウスキープ（毎日03:00）"
  else
    echo "CRON既存: ハウスキープ（スキップ）"
  fi
fi
