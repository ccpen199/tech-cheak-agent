#!/usr/bin/env node

/**
 * 飞书配置测试脚本
 * 用于验证飞书配置是否正确
 */

import dotenv from 'dotenv';
import { larkService } from './src/services/larkService.js';

dotenv.config();

async function testLarkConfig() {
  console.log('='.repeat(60));
  console.log('飞书配置测试');
  console.log('='.repeat(60));
  console.log('');

  // 检查环境变量
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  const appToken = process.env.LARK_BITABLE_APP_TOKEN;
  const tableId = process.env.LARK_BITABLE_TABLE_ID;

  console.log('环境变量检查:');
  console.log(`  LARK_APP_ID: ${appId ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  LARK_APP_SECRET: ${appSecret ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  LARK_BITABLE_APP_TOKEN: ${appToken ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  LARK_BITABLE_TABLE_ID: ${tableId ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');

  if (!appId || !appSecret || !appToken || !tableId) {
    console.log('⚠️  配置不完整，系统将运行在模拟模式。');
    console.log('请参考 飞书配置指南.md 完成配置。');
    return;
  }

  console.log('开始测试飞书连接...\n');

  try {
    // 测试1: 获取访问令牌
    console.log('[测试1] 获取访问令牌...');
    const token = await larkService.getAccessToken();
    
    if (token === 'mock_token') {
      console.log('  ❌ 获取token失败，使用模拟模式');
      console.log('  请检查 App ID 和 App Secret 是否正确');
      return;
    }
    
    console.log('  ✅ 成功获取访问令牌');
    console.log(`  Token: ${token.substring(0, 20)}...`);
    console.log('');

    // 测试2: 测试创建记录（使用测试数据）
    console.log('[测试2] 测试创建表格记录...');
    const testData = {
      docNumber: 'TEST-' + Date.now(),
      docName: '测试教案',
      originalName: 'test.docx',
      typoCount: 0,
      formatIssues: 0,
      reviewComments: '这是一条测试记录，可以删除。'
    };

    const result = await larkService.registerDocument(testData);
    
    if (result.error) {
      console.log(`  ❌ 创建记录失败: ${result.error}`);
      console.log('  可能的原因:');
      console.log('    1. 表格的 App Token 或 Table ID 不正确');
      console.log('    2. 应用权限未通过审批');
      console.log('    3. 表格字段名称不匹配');
      return;
    }

    console.log('  ✅ 成功创建测试记录');
    console.log(`  记录ID: ${result.recordId}`);
    console.log('');
    console.log('🎉 配置测试通过！');
    console.log('');
    console.log('⚠️  注意：已在表格中创建一条测试记录，请手动删除。');
    console.log(`  记录编号: ${testData.docNumber}`);

  } catch (error) {
    console.error('  ❌ 测试失败:', error.message);
    console.log('');
    console.log('可能的原因:');
    console.log('  1. 网络连接问题');
    console.log('  2. App ID 或 App Secret 错误');
    console.log('  3. 应用权限未通过审批');
    console.log('  4. 表格信息不正确');
    console.log('');
    console.log('请参考 飞书配置指南.md 进行排查。');
  }
}

testLarkConfig().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});

