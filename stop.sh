#!/bin/bash

# 停止服务脚本

if [ -f .pids ]; then
    PIDS=$(cat .pids)
    echo "正在停止服务..."
    kill $PIDS 2>/dev/null
    rm -f .pids
    echo "服务已停止"
else
    echo "未找到运行中的服务"
fi
