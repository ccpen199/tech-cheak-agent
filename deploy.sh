#!/usr/bin/env bash
set -e
APP_DIR="/home/ubuntu/app"
PORT=3000
NAME="tech-agent"

# 构建前端
cd "$APP_DIR/frontend"
npm ci
npm run build       # 产物在 frontend/dist

# 启动 / 重启后端并托管静态
cd "$APP_DIR/backend"
npm ci
pm2 delete "$NAME" || true
PORT=$PORT pm2 start src/index.js --name "$NAME" --update-env
pm2 save

echo "✅ $NAME ready -> http://<IP>:$PORT"