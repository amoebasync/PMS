#!/bin/bash
# ATF Kanban PM エージェント起動スクリプト
# 使い方: ./pm

export PATH="/Users/kuenheekim/.nvm/versions/node/v20.20.0/bin:$PATH"

# kanban UI が起動しているか確認
if ! curl -s http://localhost:3002 > /dev/null 2>&1; then
  echo "⚠️  ATF Kanban UI が起動していません。"
  echo "   別ターミナルで: cd ~/AI_TaskForce/kanban-ui && pnpm dev"
  echo ""
fi

# MCP サーバーが起動しているか確認
if ! curl -s http://localhost:3001/api/projects > /dev/null 2>&1; then
  echo "⚠️  ATF MCP サーバーが起動していません。"
  echo "   Claude Code 起動時に自動起動します（mcp.json経由）"
  echo ""
fi

echo "🚀 PMS PM エージェントを起動します..."
echo "   バックログにチケットを登録済みであれば「バックログを処理して」と入力してください。"
echo ""

cd /Users/kuenheekim/PMS
claude --print "バックログのチケットをPMとして処理してください。pm-agentの手順に従い、スプリント計画を作成して承認を求めてください。" 2>/dev/null || claude
