#!/bin/bash
# CodeDeploy BeforeInstall: デプロイ準備
cd /home/ec2-user/pms_java 2>/dev/null || exit 0

# .env と ecosystem.config.js をバックアップ（デプロイで消されないように）
echo ".env と ecosystem.config.js をバックアップ..."
cp -f .env /home/ec2-user/.env.backup 2>/dev/null || true
cp -f ecosystem.config.js /home/ec2-user/ecosystem.config.js.backup 2>/dev/null || true

# 古い .next を削除（CodeDeployは上書きのみで古いファイルを削除しないため）
echo "古い .next を削除..."
rm -rf .next
echo "完了"
