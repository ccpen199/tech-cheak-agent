#!/bin/bash

# 教案评审系统启动脚本

echo "========================================="
echo "  教案评审系统启动脚本"
echo "========================================="
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未检测到Node.js，请先安装Node.js"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "错误: 未检测到npm，请先安装npm"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 启动后端
echo "正在启动后端服务（端口4004）..."
cd backend

# 检查并安装后端依赖
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi

# 创建必要的目录
mkdir -p uploads processed

# 启动后端（后台运行）
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "后端服务正在启动 (PID: $BACKEND_PID)"
echo "后端日志: backend.log"

# 等待后端启动
sleep 5

# 检查后端是否成功启动（如果curl可用）
if command -v curl &> /dev/null; then
    if curl -s http://localhost:4004/api/health > /dev/null 2>&1; then
        echo "✓ 后端服务运行正常"
    else
        echo "⚠ 警告: 后端服务可能未正常启动，请检查 backend.log"
    fi
else
    echo "⚠ 未检测到curl，跳过健康检查"
    echo "  请手动访问 http://localhost:4004/api/health 检查后端状态"
fi

cd ..

# 启动前端
echo ""
echo "正在启动前端服务（端口3005）..."
cd frontend

# 检查并安装前端依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 启动前端（后台运行）
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端服务已启动 (PID: $FRONTEND_PID)"
echo "前端日志: frontend.log"

cd ..

echo ""
echo "========================================="
echo "  服务启动完成！"
echo "========================================="
echo ""
echo "前端地址: http://localhost:3005"
echo "后端地址: http://localhost:4004"
echo ""
echo "查看日志:"
echo "  后端: tail -f backend.log"
echo "  前端: tail -f frontend.log"
echo ""
echo "停止服务:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "或者运行: ./stop.sh"
echo ""

# 保存PID到文件
echo "$BACKEND_PID $FRONTEND_PID" > .pids

# 等待用户中断
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .pids; exit" INT TERM

wait
