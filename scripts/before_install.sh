#!/bin/bash
# CodeDeploy BeforeInstall: 古いビルド成果物を削除
# CodeDeployは上書きのみで古いファイルを削除しないため、
# .nextの古いビルドキャッシュを明示的に削除する
cd /home/ec2-user/pms_java 2>/dev/null || exit 0
echo "古い .next を削除..."
rm -rf .next
echo "完了"
