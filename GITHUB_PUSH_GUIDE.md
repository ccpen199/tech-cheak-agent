# GitHub 推送指南

本文档详细说明如何将 `tech-cheak-agent` 项目推送到 GitHub。

## 📋 前置条件

1. 已安装 Git
2. 拥有 GitHub 账号（用户名：`ccpen199`）
3. 已配置 Git 用户信息（如果未配置，请先执行）：
   ```bash
   git config --global user.name "你的名字"
   git config --global user.email "你的邮箱"
   ```

## 🚀 推送步骤

### 步骤 1：在 GitHub 上创建仓库

1. 访问 [GitHub 新建仓库页面](https://github.com/new)
2. 填写仓库信息：
   - **Repository name**: `tech-cheak-agent`
   - **Description**: （可选）项目描述
   - **Visibility**: 选择 Public（公开）或 Private（私有）
   - ⚠️ **重要**：**不要**勾选以下选项：
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   （因为本地已有这些文件）
3. 点击 **"Create repository"** 按钮

### 步骤 2：配置远程仓库

如果远程仓库已存在但地址不对，先更新：

```bash
# 查看当前远程仓库地址
git remote -v

# 更新为正确的地址（HTTPS 方式）
git remote set-url origin https://github.com/ccpen199/tech-cheak-agent.git

# 或者使用 SSH 方式（推荐，需要先配置 SSH 密钥）
git remote set-url origin git@github.com:ccpen199/tech-cheak-agent.git
```

如果是第一次添加远程仓库：

```bash
git remote add origin https://github.com/ccpen199/tech-cheak-agent.git
```

### 步骤 3：确认本地代码已提交

```bash
# 检查状态
git status

# 如果有未提交的更改，先添加并提交
git add .
git commit -m "你的提交信息"
```

### 步骤 4：推送到 GitHub

```bash
# 确保在 main 分支
git branch -M main

# 推送到 GitHub（首次推送）
git push -u origin main

# 之后的推送可以直接使用
git push
```

## 🔐 认证方式

### 方式 1：HTTPS + Personal Access Token（推荐）

GitHub 已不再支持使用密码进行 HTTPS 认证，必须使用 Personal Access Token。

#### 创建 Personal Access Token

1. 访问 [GitHub Token 设置页面](https://github.com/settings/tokens)
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 填写 Token 信息：
   - **Note**: 给 Token 起个名字，如 "tech-cheak-agent-push"
   - **Expiration**: 选择过期时间（建议选择较长时间或 No expiration）
   - **Select scopes**: 至少勾选 `repo` 权限
4. 点击 **"Generate token"**
5. ⚠️ **重要**：立即复制 Token（只显示一次，格式类似：`ghp_xxxxxxxxxxxxxxxxxxxx`）

#### 使用 Token 推送

推送时，当提示输入密码时，**粘贴 Token 而不是密码**：
- Username: `ccpen199`
- Password: `粘贴你的 Token`

#### 保存 Token（可选，方便后续使用）

macOS 可以使用钥匙串保存：

```bash
# 推送时会提示输入用户名和密码，输入后会自动保存
git push -u origin main
```

或者使用 Git Credential Helper：

```bash
# 配置 Git 使用 macOS 钥匙串
git config --global credential.helper osxkeychain
```

### 方式 2：SSH 密钥（更安全，推荐长期使用）

#### 检查是否已有 SSH 密钥

```bash
ls -al ~/.ssh
```

如果看到 `id_rsa.pub` 或 `id_ed25519.pub`，说明已有密钥。

#### 生成新的 SSH 密钥（如果没有）

```bash
# 生成 SSH 密钥（替换为你的 GitHub 邮箱）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 按提示操作：
# - 按 Enter 使用默认文件位置
# - 设置密码（可选，但推荐）
```

#### 添加 SSH 密钥到 GitHub

1. 复制公钥内容：
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # 或
   cat ~/.ssh/id_rsa.pub
   ```

2. 访问 [GitHub SSH 设置页面](https://github.com/settings/keys)
3. 点击 **"New SSH key"**
4. 填写信息：
   - **Title**: 给密钥起个名字，如 "MacBook Pro"
   - **Key**: 粘贴刚才复制的公钥内容
5. 点击 **"Add SSH key"**

#### 测试 SSH 连接

```bash
ssh -T git@github.com
```

如果看到 "Hi ccpen199! You've successfully authenticated..." 说明配置成功。

#### 使用 SSH 推送

```bash
# 更新远程地址为 SSH
git remote set-url origin git@github.com:ccpen199/tech-cheak-agent.git

# 推送
git push -u origin main
```

## 📝 使用自动化脚本

项目根目录下的 `docx/PUSH_TO_GITHUB.sh` 脚本可以自动完成部分操作：

```bash
# 进入脚本目录
cd docx

# 给脚本添加执行权限（首次使用）
chmod +x PUSH_TO_GITHUB.sh

# 运行脚本
./PUSH_TO_GITHUB.sh
```

⚠️ **注意**：使用脚本前需要：
1. 确保 GitHub 仓库已创建
2. 已配置好认证方式（Token 或 SSH）

## ❓ 常见问题

### Q1: 推送时提示 "Repository not found"

**原因**：GitHub 上还没有创建该仓库。

**解决**：按照步骤 1 在 GitHub 上创建仓库。

### Q2: 推送时提示 "Authentication failed"

**原因**：认证信息错误或未配置。

**解决**：
- 如果使用 HTTPS：检查 Token 是否正确，是否有 `repo` 权限
- 如果使用 SSH：检查 SSH 密钥是否已添加到 GitHub

### Q3: 推送时提示 "Permission denied"

**原因**：没有该仓库的写入权限。

**解决**：
- 确认仓库名称正确
- 确认你是仓库的所有者或有写入权限的协作者

### Q4: 如何更新远程仓库地址？

```bash
# 查看当前地址
git remote -v

# 更新为 HTTPS
git remote set-url origin https://github.com/ccpen199/tech-cheak-agent.git

# 更新为 SSH
git remote set-url origin git@github.com:ccpen199/tech-cheak-agent.git
```

### Q5: 如何查看推送历史？

```bash
# 查看提交历史
git log --oneline

# 查看远程仓库信息
git remote show origin
```

## 🔄 日常推送流程

推送完成后，日常的代码更新流程：

```bash
# 1. 查看更改
git status

# 2. 添加更改
git add .

# 3. 提交更改
git commit -m "描述你的更改"

# 4. 推送到 GitHub
git push
```

## 📚 相关资源

- [GitHub 官方文档](https://docs.github.com/)
- [Git 官方文档](https://git-scm.com/doc)
- [创建 Personal Access Token](https://github.com/settings/tokens)
- [配置 SSH 密钥](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

## ✅ 检查清单

推送前确认：

- [ ] GitHub 仓库已创建
- [ ] 远程仓库地址已正确配置
- [ ] 本地代码已提交（`git status` 显示 "nothing to commit"）
- [ ] 已配置认证方式（Token 或 SSH）
- [ ] 测试连接成功（SSH 方式）

---

**仓库地址**：https://github.com/ccpen199/tech-cheak-agent

如有问题，请参考上述常见问题部分或查看 GitHub 官方文档。

