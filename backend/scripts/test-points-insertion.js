/**
 * 测试要点插入逻辑
 */

// 模拟显示逻辑
function testDisplayLogic() {
  console.log('=== 测试显示逻辑 ===\n');
  
  // 场景1：有3个要点，有指导语
  const points1 = [
    { prefix: '￮', content: '要点1' },
    { prefix: '￮', content: '要点2' },
    { prefix: '￮', content: '要点3' }
  ];
  const guidance1 = '这是指导语';
  
  const pointLines1 = points1.map((p) => {
    const prefix = p.prefix || '￮';
    return `${prefix} ${p.content || ''}`;
  });
  if (guidance1.trim()) {
    pointLines1.push(`指导语：${guidance1}`);
  }
  
  console.log('场景1：有3个要点，有指导语');
  console.log('显示顺序：');
  pointLines1.forEach((line, index) => {
    console.log(`${index + 1}. ${line}`);
  });
  console.log('预期：新要点应该在倒数第二行（第3行），指导语在最后（第4行）\n');
  
  // 场景2：新增一个要点后
  const points2 = [...points1, { prefix: '￮', content: '' }];
  const pointLines2 = points2.map((p) => {
    const prefix = p.prefix || '￮';
    return `${prefix} ${p.content || ''}`;
  });
  if (guidance1.trim()) {
    pointLines2.push(`指导语：${guidance1}`);
  }
  
  console.log('场景2：新增一个要点后（追加到points数组末尾）');
  console.log('显示顺序：');
  pointLines2.forEach((line, index) => {
    console.log(`${index + 1}. ${line}`);
  });
  console.log('预期：新要点应该在倒数第二行（第4行），指导语在最后（第5行）\n');
  
  // 验证
  const newPointIndex = pointLines2.length - 2; // 倒数第二行
  const guidanceIndex = pointLines2.length - 1; // 最后一行
  const isCorrect = !pointLines2[newPointIndex].includes('指导语') && 
                    pointLines2[guidanceIndex].includes('指导语');
  
  console.log('验证结果：', isCorrect ? '✅ 正确' : '❌ 错误');
  console.log(`新要点位置：第${newPointIndex + 1}行 (${pointLines2[newPointIndex]})`);
  console.log(`指导语位置：第${guidanceIndex + 1}行 (${pointLines2[guidanceIndex]})`);
}

testDisplayLogic();

