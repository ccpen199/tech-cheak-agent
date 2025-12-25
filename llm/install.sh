#!/bin/bash

# LLM模块依赖安装脚本

echo "=========================================="
echo "安装LLM模块依赖"
echo "=========================================="
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3，请先安装Python 3.7+"
    exit 1
fi

echo "✅ 找到 Python: $(python3 --version)"
echo ""

# 进入llm目录
cd "$(dirname "$0")"

# 检查requirements.txt是否存在
if [ ! -f "requirements.txt" ]; then
    echo "❌ 错误: requirements.txt 文件不存在"
    exit 1
fi

echo "📦 开始安装Python依赖..."
echo ""

# 安装依赖
python3 -m pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 依赖安装成功！"
    echo ""
    echo "下一步："
    echo "1. 配置 llm/.env 文件，填入 MODELSCOPE_API_KEY"
    echo "2. 重启后端服务"
else
    echo ""
    echo "❌ 依赖安装失败，请检查错误信息"
    exit 1
fi

