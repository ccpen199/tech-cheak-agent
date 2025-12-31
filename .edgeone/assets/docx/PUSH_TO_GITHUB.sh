#!/bin/bash
# 推送代码到GitHub的脚本
# 使用前请修改 YOUR_USERNAME 为你的GitHub用户名

echo "🚀 准备推送代码到GitHub..."
echo ""

# 请替换为你的GitHub用户名和仓库名
GITHUB_USERNAME="ccpen199"  # 修改这里！
REPO_NAME="tech-cheak-agent"  # 如果需要，也可以修改这里

# 添加远程仓库（HTTPS方式）
echo "📎 添加远程仓库..."
git remote add origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git

# 如果远程仓库已存在，先删除再添加
if git remote get-url origin &>/dev/null; then
    echo "⚠️  远程仓库已存在，更新地址..."
    git remote set-url origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git
fi

# 设置主分支为 main（GitHub默认）
echo "🌿 设置主分支为 main..."
git branch -M main

# 推送到GitHub
echo "📤 推送代码到GitHub..."
echo ""
echo "⚠️  注意：如果是第一次推送，GitHub会要求输入："
echo "   - Username: 你的GitHub用户名"
echo "   - Password: 使用 Personal Access Token（不是密码）"
echo ""
echo "   如果没有Token，请访问："
echo "   https://github.com/settings/tokens"
echo "   生成新Token（选择 repo 权限）"
echo ""
read -p "按回车继续推送，或 Ctrl+C 取消..."

git push -u origin main

echo ""
echo "✅ 完成！你的代码已经推送到GitHub了！"
echo ""
echo "🔗 仓库地址: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"

