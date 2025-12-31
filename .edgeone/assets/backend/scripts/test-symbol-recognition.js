/**
 * 测试SY002模板要点符号识别
 */

// 模拟后端解析器的符号识别逻辑
function testSymbolRecognition() {
  const symbolPrefixes = ['￮', '•', '·', '-', '—', '○', '●', '▪', '▫', '→'];
  
  // 测试用例：用户提供的符号
  const testCases = [
    '￮要点内容1',
    '•要点内容2',
    '·要点内容3',
    '-要点内容4',
    '—要点内容5',
    '○要点内容6',
    '●要点内容7',
    '▪要点内容8',
    '▫要点内容9',
    '→要点内容10',
    '  ￮要点内容11', // 前面有空格
    '要点内容12', // 没有符号
  ];
  
  console.log('=== 符号识别测试 ===\n');
  
  testCases.forEach((testCase, index) => {
    const trimmed = testCase.trim();
    let recognized = false;
    let recognizedSymbol = null;
    let content = null;
    
    // 先匹配数字序号格式
    const numberedMatch = trimmed.match(/^(\d+)([\.。、])\s*(.*)/);
    if (numberedMatch) {
      content = numberedMatch[3].trim();
      recognizedSymbol = numberedMatch[1] + numberedMatch[2];
      recognized = true;
    } else {
      // 匹配符号前缀
      for (const prefix of symbolPrefixes) {
        if (trimmed.startsWith(prefix)) {
          content = trimmed.substring(prefix.length).trim();
          recognizedSymbol = prefix;
          recognized = true;
          break;
        }
      }
    }
    
    const status = recognized ? '✅ 识别成功' : '❌ 未识别';
    const symbolInfo = recognizedSymbol ? `符号: "${recognizedSymbol}"` : '无符号';
    const contentInfo = content ? `内容: "${content}"` : '无内容';
    
    console.log(`测试 ${index + 1}: ${testCase}`);
    console.log(`  结果: ${status}`);
    console.log(`  ${symbolInfo}, ${contentInfo}`);
    console.log('');
  });
  
  // 测试符号列表
  console.log('\n=== 支持的符号列表 ===');
  symbolPrefixes.forEach((symbol, index) => {
    console.log(`${index + 1}. "${symbol}" (Unicode: U+${symbol.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
  });
}

// 运行测试
testSymbolRecognition();

