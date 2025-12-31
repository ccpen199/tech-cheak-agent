/**
 * 测试SY001模板解析
 */

import { TemplateParserFactory } from '../src/services/templates/TemplateParserFactory.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  const filePath = path.join(__dirname, '../../docx/models/SY001-童萌-节庆活动方案模板.docx');
  
  console.log('解析模板:', filePath);
  const result = await TemplateParserFactory.parseDocument(filePath, 'SY001');
  
  if (result.success) {
    console.log('\n解析成功！');
    console.log('\n结构:', JSON.stringify(result.structure, null, 2));
    
    // 检查操作方法
    const segmentsSection = result.structure.sections.find(s => s.type === 'segments');
    if (segmentsSection && segmentsSection.items) {
      console.log('\n环节数量:', segmentsSection.items.length);
      segmentsSection.items.forEach((seg, i) => {
        console.log(`\n环节${i + 1}:`);
        console.log('  操作方法items数量:', seg.method?.items?.length || 0);
        if (seg.method?.items?.length > 0) {
          seg.method.items.forEach(item => {
            console.log(`    ${item.number}. ${item.content.substring(0, 30)}...`);
          });
        }
        console.log('  教师指导语items数量:', seg.guidance?.items?.length || 0);
        if (seg.guidance?.items?.length > 0) {
          seg.guidance.items.forEach(item => {
            console.log(`    ${item.number}. ${item.content.substring(0, 30)}...`);
          });
        }
      });
    }
  } else {
    console.error('解析失败:', result.error);
  }
}

test().catch(console.error);

