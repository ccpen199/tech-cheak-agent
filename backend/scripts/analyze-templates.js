/**
 * 分析所有模板的结构和样式
 */

import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesDir = path.join(__dirname, '../../docx/models');

async function extractStylesFromDocx(filePath) {
  const zip = new AdmZip(filePath);
  const stylesXml = zip.readAsText('word/styles.xml');
  const documentXml = zip.readAsText('word/document.xml');
  
  // 提取字体信息
  const fontMatches = stylesXml.match(/<w:rFonts[^>]*>/g) || [];
  const sizeMatches = stylesXml.match(/<w:sz[^>]*w:val="(\d+)"[^>]*>/g) || [];
  
  // 提取表格样式
  const tblPrMatch = documentXml.match(/<w:tblPr>(.*?)<\/w:tblPr>/s);
  
  return {
    fonts: fontMatches,
    sizes: sizeMatches.map(m => m.match(/w:val="(\d+)"/)?.[1]),
    tableStyle: tblPrMatch ? tblPrMatch[1].substring(0, 500) : null
  };
}

async function analyzeTemplate(filename) {
  const filePath = path.join(templatesDir, filename);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 分析模板: ${filename}`);
  console.log('='.repeat(60));
  
  try {
    // 1. 提取文本内容
    const textResult = await mammoth.extractRawText({ path: filePath });
    const text = textResult.value;
    const lines = text.split('\n').filter(l => l.trim());
    
    console.log('\n📝 文档内容预览（前30行）:');
    lines.slice(0, 30).forEach((line, i) => {
      if (line.trim()) console.log(`${i + 1}: ${line}`);
    });
    
    // 2. 提取样式信息
    console.log('\n🎨 样式信息:');
    const styles = await extractStylesFromDocx(filePath);
    console.log('字体定义:', styles.fonts.slice(0, 3));
    console.log('字号:', styles.sizes.slice(0, 5));
    if (styles.tableStyle) {
      console.log('表格样式片段:', styles.tableStyle.substring(0, 200));
    }
    
    // 3. 识别基本信息字段
    console.log('\n📋 基本信息字段识别:');
    const basicInfoPatterns = [
      /节\s*日/,
      /活动名称/,
      /材\s*料/,
      /活动目标/,
      /活动准备/,
      /活动过程/,
      /活动延伸/
    ];
    const foundFields = [];
    lines.forEach((line, i) => {
      basicInfoPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          foundFields.push({ line: i + 1, text: line.trim() });
        }
      });
    });
    console.log('找到的字段:', foundFields);
    
    // 4. 识别环节/步骤
    console.log('\n🔄 环节/步骤识别:');
    const segmentPatterns = [
      /环节\s*\d+/,
      /步骤\s*\d+/,
      /第\s*[一二三四五六七八九十\d]+\s*[步环节]/,
      /阶段\s*\d+/
    ];
    const foundSegments = [];
    lines.forEach((line, i) => {
      segmentPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          foundSegments.push({ line: i + 1, text: line.trim() });
        }
      });
    });
    console.log('找到的环节/步骤:', foundSegments.slice(0, 10));
    
    // 5. 识别子字段（操作方法、分工等）
    console.log('\n📌 子字段识别:');
    const subFieldPatterns = [
      /操作方法/,
      /主\/助教分工/,
      /教师指导语/,
      /活动内容/,
      /注意事项/,
      /材料准备/
    ];
    const foundSubFields = [];
    lines.forEach((line, i) => {
      subFieldPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          foundSubFields.push({ line: i + 1, text: line.trim() });
        }
      });
    });
    console.log('找到的子字段:', foundSubFields.slice(0, 10));
    
    return {
      filename,
      totalLines: lines.length,
      basicInfoFields: foundFields,
      segments: foundSegments,
      subFields: foundSubFields,
      styles
    };
  } catch (error) {
    console.error(`❌ 分析 ${filename} 时出错:`, error.message);
    return { filename, error: error.message };
  }
}

async function main() {
  const files = fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.docx') && !f.startsWith('~'));
  
  console.log(`\n找到 ${files.length} 个模板文件:`);
  files.forEach(f => console.log(`  - ${f}`));
  
  const results = [];
  for (const file of files) {
    const result = await analyzeTemplate(file);
    results.push(result);
  }
  
  // 生成汇总报告
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 模板分析汇总');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    if (result.error) {
      console.log(`\n❌ ${result.filename}: ${result.error}`);
    } else {
      console.log(`\n✅ ${result.filename}:`);
      console.log(`   总行数: ${result.totalLines}`);
      console.log(`   基本信息字段: ${result.basicInfoFields.length} 个`);
      console.log(`   环节/步骤: ${result.segments.length} 个`);
      console.log(`   子字段: ${result.subFields.length} 个`);
    }
  });
  
  // 保存分析结果
  const outputPath = path.join(__dirname, '../../template-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 分析结果已保存到: ${outputPath}`);
}

main().catch(console.error);

