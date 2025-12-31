#!/usr/bin/env bash
set -e
# === ❶ 服务器登录信息 ===
REMOTE_USER=ubuntu
REMOTE_IP=111.230.16.233
KEY_PATH=$HOME/Desktop/chenTcent.pem

# === ❷ 服务器目标目录 (每个项目不同) ===
REMOTE_DIR=/home/ubuntu/app

# === ❸ 远程 deploy.sh 路径 ===
REMOTE_DEPLOY_SCRIPT=$REMOTE_DIR/deploy.sh

echo "🔄 rsync 源码到服务器 …"
rsync -avz --delete \
      --exclude 'node_modules' \
      --exclude '.git' \
      --exclude '*.log' \
      --exclude 'uploads' \
      --exclude 'processed' \
      --exclude 'backend/uploads' \
      --exclude 'backend/processed' \
      --exclude '.DS_Store' \
      --exclude '*.swp' \
      --exclude '*.swo' \
      --exclude '.vscode' \
      --exclude '.idea' \
      -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
      ./  ${REMOTE_USER}@${REMOTE_IP}:${REMOTE_DIR} \
      --progress

echo "�� 远程执行 deploy.sh …"
ssh -i $KEY_PATH -o StrictHostKeyChecking=no \
    ${REMOTE_USER}@${REMOTE_IP} "bash $REMOTE_DEPLOY_SCRIPT"