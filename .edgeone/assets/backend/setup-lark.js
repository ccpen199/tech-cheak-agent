#!/usr/bin/env node

/**
 * 飞书配置助手
 * 帮助用户快速配置飞书环境变量
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('='.repeat(60));
  console.log('飞书云表格配置助手');
  console.log('='.repeat(60));
  console.log('');
  console.log('请按照提示输入飞书配置信息。');
  console.log('如果暂时不想配置，可以直接按回车跳过，系统将运行在模拟模式。');
  console.log('');

  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');

  // 检查是否已存在 .env 文件
  if (fs.existsSync(envPath)) {
    const overwrite = await question('检测到已存在 .env 文件，是否覆盖？(y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('已取消配置。');
      rl.close();
      return;
    }
  }

  console.log('\n--- 步骤1: 飞书应用配置 ---');
  console.log('请访问 https://open.feishu.cn 创建应用并获取以下信息：\n');

  const appId = await question('请输入 App ID（留空跳过）: ');
  const appSecret = await question('请输入 App Secret（留空跳过）: ');

  console.log('\n--- 步骤2: 多维表格配置 ---');
  console.log('请打开您的飞书多维表格，从浏览器URL中获取以下信息：\n');
  console.log('URL格式示例: https://xxx.feishu.cn/base/AppToken123?table=TableID456');
  console.log('App Token 是 base/ 后面的部分（到 ? 之前）');
  console.log('Table ID 是 table= 后面的部分\n');

  const appToken = await question('请输入 App Token（留空跳过）: ');
  const tableId = await question('请输入 Table ID（留空跳过）: ');

  const port = await question('请输入后端端口（默认4004，直接回车使用默认值）: ') || '4004';

  // 生成 .env 文件内容
  let envContent = `# 飞书应用配置
# 自动生成于 ${new Date().toLocaleString('zh-CN')}

`;

  if (appId) {
    envContent += `LARK_APP_ID=${appId}\n`;
  } else {
    envContent += `# LARK_APP_ID=your_app_id_here\n`;
  }

  if (appSecret) {
    envContent += `LARK_APP_SECRET=${appSecret}\n`;
  } else {
    envContent += `# LARK_APP_SECRET=your_app_secret_here\n`;
  }

  envContent += `\n# 飞书多维表格配置\n`;

  if (appToken) {
    envContent += `LARK_BITABLE_APP_TOKEN=${appToken}\n`;
  } else {
    envContent += `# LARK_BITABLE_APP_TOKEN=your_bitable_app_token_here\n`;
  }

  if (tableId) {
    envContent += `LARK_BITABLE_TABLE_ID=${tableId}\n`;
  } else {
    envContent += `# LARK_BITABLE_TABLE_ID=your_bitable_table_id_here\n`;
  }

  envContent += `\n# 后端服务端口\nPORT=${port}\n`;

  // 写入文件
  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('\n✅ 配置已保存到 backend/.env 文件');
    console.log('\n配置摘要:');
    console.log(`  App ID: ${appId || '(未配置)'}`);
    console.log(`  App Secret: ${appSecret ? '***已配置***' : '(未配置)'}`);
    console.log(`  App Token: ${appToken || '(未配置)'}`);
    console.log(`  Table ID: ${tableId || '(未配置)'}`);
    console.log(`  端口: ${port}`);
    
    if (!appId || !appSecret || !appToken || !tableId) {
      console.log('\n⚠️  部分配置未完成，系统将运行在模拟模式。');
      console.log('请参考 飞书配置指南.md 完成完整配置。');
    } else {
      console.log('\n🎉 配置完成！请重启后端服务以使配置生效。');
    }
  } catch (error) {
    console.error('\n❌ 保存配置失败:', error.message);
  }

  rl.close();
}

setup().catch(error => {
  console.error('配置过程出错:', error);
  rl.close();
  process.exit(1);
});

