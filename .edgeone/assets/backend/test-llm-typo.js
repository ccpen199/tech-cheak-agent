#!/usr/bin/env node
/**
 * LLM错别字检测测试脚本
 * 用于测试LLM智能体的错别字检测功能
 */

import { checkTyposWithLLM, formatTypoSummary } from './src/services/llmTypoChecker.js';

// 测试用例
const testCases = [
  {
    name: '正常文本（无错别字）',
    text: '今天天气很好，我们去公园玩。小明说："我要去买冰淇淋。"小红回答："我也要去，我们一起走吧。"'
  },
  {
    name: '包含错别字：冰激凌',
    text: '今天天气很好，我们去公园玩。小明说："我要去买冰激凌。"小红回答："我也要去，我们一起走吧。"'
  },
  {
    name: '包含错别字：必需',
    text: '我必需去学校，因为今天有重要的考试。'
  },
  {
    name: '包含错别字：在/再',
    text: '我再学校等你，你一定要来。'
  },
  {
    name: '包含错别字：的/得/地',
    text: '他跑地很快，我们追不上他。'
  },
  {
    name: '长文本测试',
    text: `今天天气很好，我们去公园玩。小明说："我要去买冰激凌。"小红回答："我也要去，我们一起走吧。"
    
我们走在路上，看到很多美丽的花朵。小明说："这些花真漂亮！"小红点头同意："是啊，春天的花总是最美的。"
    
到了公园，我们找了一个地方坐下来。小明去买冰激凌，小红在等我。过了一会儿，小明回来了，手里拿着两个冰激凌。
    
"给你一个！"小明说。小红接过冰激凌，笑着说："谢谢！"我们一边吃冰激凌，一边聊天，非常开心。`
  }
];

/**
 * 运行单个测试用例
 */
async function runTest(testCase, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试 ${index + 1}/${testCases.length}: ${testCase.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n输入文本（前100字符）:`);
  console.log(testCase.text.substring(0, 100) + (testCase.text.length > 100 ? '...' : ''));
  console.log(`\n文本总长度: ${testCase.text.length} 字符`);
  
  const startTime = Date.now();
  
  try {
    console.log('\n🔍 开始检测错别字...');
    const typos = await checkTyposWithLLM(testCase.text);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ 检测完成（耗时: ${duration}ms）`);
    console.log(`\n检测结果:`);
    console.log(`- 错别字数量: ${typos.length}`);
    
    if (typos.length > 0) {
      console.log(`\n发现的错别字:`);
      typos.forEach((typo, i) => {
        console.log(`  ${i + 1}. "${typo.word}" → "${typo.correct}"`);
        if (typo.context) {
          console.log(`     上下文: ${typo.context.substring(0, 50)}...`);
        }
        if (typo.position !== undefined) {
          console.log(`     位置: ${typo.position}`);
        }
      });
      
      const summary = formatTypoSummary(typos);
      console.log(`\n格式化摘要:`);
      console.log(summary);
    } else {
      console.log(`\n未发现错别字`);
    }
    
    return { success: true, typos, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ 检测失败（耗时: ${duration}ms）`);
    console.error(`错误信息: ${error.message}`);
    return { success: false, error: error.message, duration };
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始LLM错别字检测测试');
  console.log(`测试用例数量: ${testCases.length}`);
  console.log(`\n注意: 如果LLM API未配置或连接失败，将返回空结果`);
  
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i);
    results.push(result);
    
    // 在测试之间稍作延迟，避免API限流
    if (i < testCases.length - 1) {
      console.log('\n⏳ 等待2秒后继续下一个测试...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 汇总结果
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 测试结果汇总');
  console.log(`${'='.repeat(60)}`);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalTypos = results.reduce((sum, r) => sum + (r.typos ? r.typos.length : 0), 0);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`\n总测试数: ${results.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`总检测到错别字: ${totalTypos} 个`);
  console.log(`平均耗时: ${Math.round(avgDuration)}ms`);
  
  console.log(`\n详细结果:`);
  results.forEach((result, i) => {
    const testCase = testCases[i];
    const status = result.success ? '✅' : '❌';
    const typosCount = result.typos ? result.typos.length : 0;
    console.log(`  ${status} ${testCase.name}: ${typosCount} 个错别字, ${result.duration}ms`);
  });
  
  // 如果所有测试都失败，给出提示
  if (failCount === results.length) {
    console.log(`\n⚠️  所有测试都失败，可能的原因:`);
    console.log(`  1. LLM API未配置（检查 llm/.env 文件）`);
    console.log(`  2. Python依赖未安装（运行: cd llm && pip install -r requirements.txt）`);
    console.log(`  3. 网络连接问题`);
  } else if (totalTypos === 0 && successCount > 0) {
    console.log(`\n⚠️  所有测试都成功，但未检测到错别字`);
    console.log(`  这可能是因为:`);
    console.log(`  1. LLM API连接失败，返回了空结果`);
    console.log(`  2. 测试文本确实没有错别字`);
    console.log(`  3. LLM模型未正确配置`);
  }
}

// 运行测试
runAllTests().catch(error => {
  console.error('\n❌ 测试运行失败:', error);
  process.exit(1);
});

