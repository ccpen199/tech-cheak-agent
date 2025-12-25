/**
 * 测试SY001模板格式识别和验证
 */
import { sy001FormatChecker } from '../src/services/sy001FormatChecker.js';

// 测试文本（基于用户提供的模板）
const testText = `童萌-节庆活动方案模板
节  日	xxxx
活动名称	x
材  料	xxx
环节流程



	环节1：学习古诗《元日》	x分钟
	•操作方法：
1.xxxx'x'x。
2.xxx。
3.xxxx。
•主/助教分工：
xxx
•教师指导语：
1.xxxxxx
2.xxxxxxxxx。
	环节2：xxx 	x分钟
	•操作方法：
xxxx。
•主/助教分工：
主xxxx
•教师指导语：
xxxxxxxx
	环节3：xxx 后面继续添加环节3/4	x分钟
	•操作方法：
xxxx。
•主/助教分工：
主xxxx
•教师指导语：
xxxxxxxx
	环节4：xxx 后面继续添加环节3/4	x分钟
	•操作方法：
xxxx。
•主/助教分工：
主xxxx
•教师指导语：
xxxxxxxx
示例图片2`;

console.log('='.repeat(60));
console.log('测试SY001模板格式识别和验证');
console.log('='.repeat(60));

const result = sy001FormatChecker.checkFormat(testText, 'SY001-童萌-节庆活动方案模板.docx');

console.log('\n识别结果:');
console.log('  是否为SY001模板:', result.isSY001 ? '✅ 是' : '❌ 否');
if (result.isSY001) {
  console.log('  模板ID:', result.templateId);
  console.log('  模板名称:', result.templateName);
  console.log('  验证状态:', result.isValid ? '✅ 通过' : '❌ 未通过');
  console.log('  错误数量:', result.errorCount);
  console.log('  警告数量:', result.warningCount);
  
  if (result.errorCount > 0) {
    console.log('\n格式错误:');
    result.issues.filter(i => i.severity === 'error').forEach((error, idx) => {
      console.log(`  ${idx + 1}. [${error.type}] ${error.description}${error.line ? ` (第${error.line}行)` : ''}`);
      if (error.content) {
        console.log(`     内容: ${error.content}`);
      }
    });
  }
  
  if (result.warningCount > 0) {
    console.log('\n格式警告:');
    result.warnings.forEach((warning, idx) => {
      console.log(`  ${idx + 1}. [${warning.type}] ${warning.description}${warning.line ? ` (第${warning.line}行)` : ''}`);
      if (warning.content) {
        console.log(`     内容: ${warning.content}`);
      }
    });
  }
  
  console.log('\n格式化结果（用于前端显示）:');
  const displayResult = sy001FormatChecker.formatResultsForDisplay(result);
  console.log(JSON.stringify(displayResult, null, 2));
} else {
  console.log('  ❌ 未能识别为SY001模板');
}

console.log('\n' + '='.repeat(60));
console.log('测试完成');

