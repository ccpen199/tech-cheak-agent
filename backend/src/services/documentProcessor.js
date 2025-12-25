import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { larkService } from './larkService.js';
import { typoChecker } from './typoChecker.js';
import { formatChecker } from './formatChecker.js';
import { checkTyposWithLLM, formatTypoSummary } from './llmTypoChecker.js';
import { sy001FormatChecker } from './sy001FormatChecker.js';
import { TemplateParserFactory } from './templates/TemplateParserFactory.js';
import { evaluateTeachingWithLLM } from './teachingEvaluationService.js';
import { suggestModificationsWithLLM } from './modificationSuggestionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 处理上传的文档
 */
export async function processDocument(filePath, originalName) {
  try {
    // 检查文件扩展名
    const fileExt = path.extname(originalName).toLowerCase();
    
    // mammoth 库只支持 .docx 格式，不支持旧的 .doc 格式
    if (fileExt === '.doc') {
      throw new Error(
        '不支持 .doc 格式文件。请将文件转换为 .docx 格式后再上传。\n' +
        '转换方法：\n' +
        '1. 用 Microsoft Word 打开 .doc 文件\n' +
        '2. 点击"文件" -> "另存为"\n' +
        '3. 选择文件类型为"Word 文档 (*.docx)"\n' +
        '4. 保存后重新上传'
      );
    }
    
    if (fileExt !== '.docx') {
      throw new Error(`不支持的文件格式: ${fileExt}，仅支持 .docx 格式`);
    }

    // 1. 读取Word文档内容（仅支持 .docx 格式）
    const docxBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;

    // 1.1 解析文档结构（用于前端显示和编辑）
    // 自动识别模板类型并解析
    const parseResult = await TemplateParserFactory.parseDocument(filePath);
    const documentStructure = parseResult.success ? parseResult.structure : null;
    console.log('模板识别结果:', parseResult.templateId || '未知');
    console.log('文档结构解析:', documentStructure ? '成功' : '失败');
    if (documentStructure) {
      console.log('文档结构类型:', documentStructure.templateId);
      console.log('文档结构sections数量:', documentStructure.sections ? documentStructure.sections.length : 0);
    } else {
      console.error('文档结构解析失败:', parseResult.error);
    }

    // 2. 提取文档编号和名称
    const docInfo = extractDocumentInfo(text, originalName);
    console.log('提取的文档信息:', docInfo);

    // 3. 检测错别字（优先使用LLM智能体）
    let typoResults = [];
    let llmTypoSummary = '';
    let llmError = null;
    
    try {
      console.log('🔍 使用LLM智能体检测错别字...');
      const llmResults = await checkTyposWithLLM(text);
      
      // 检查返回结果格式：可能是数组（旧格式）或对象（新格式）
      let llmSuccess = false;
      let typos = [];
      
      if (Array.isArray(llmResults)) {
        // 旧格式：直接是数组
        typos = llmResults;
        llmSuccess = true; // 如果能返回数组，说明LLM调用成功
      } else if (llmResults && typeof llmResults === 'object') {
        // 新格式：对象，包含typos和llm_success
        typos = llmResults.typos || [];
        llmSuccess = llmResults.llm_success !== false;
      }
      
      if (llmSuccess) {
        // LLM调用成功（无论是否检测到错别字）
        typoResults = typos;
        if (typos.length > 0) {
          llmTypoSummary = formatTypoSummary(typos);
          console.log('✅ LLM智能体检测结果:', typoResults.length, '个错别字');
        } else {
          llmTypoSummary = '未发现错别字（LLM智能检测）';
          console.log('✅ LLM智能体检测完成，未发现错别字');
        }
      } else {
        // LLM调用失败
        llmError = 'LLM检测未返回结果（可能是API配置问题、网络问题或依赖未安装）';
        console.log('⚠️  LLM检测无结果（可能是API配置问题或网络问题）');
        console.log('💡 提示：传统方法检测能力有限，建议配置LLM以获得更好的错别字检测效果');
        console.log('   请检查：');
        console.log('   1. llm/.env 文件中是否配置了 MODELSCOPE_API_KEY');
        console.log('   2. 是否已安装Python依赖：cd llm && pip install -r requirements.txt');
        console.log('   3. 网络连接是否正常');
        
        // 传统方法检测能力有限，但作为降级方案
        typoResults = await typoChecker.checkTypos(text);
        if (typoResults.length === 0) {
          console.log('⚠️  传统方法未检测到错别字（传统方法检测能力有限）');
        } else {
          console.log('传统方法检测结果:', typoResults.length, '个');
        }
      }
    } catch (error) {
      llmError = error.message;
      console.error('❌ LLM错别字检测失败:', error.message);
      console.log('💡 降级到传统方法（检测能力有限）...');
      
      // 传统方法作为降级方案
      typoResults = await typoChecker.checkTypos(text);
      if (typoResults.length === 0) {
        console.log('⚠️  传统方法未检测到错别字');
        console.log('💡 建议：配置LLM智能体以获得准确的错别字检测');
      } else {
        console.log('传统方法检测结果:', typoResults.length, '个');
      }
    }

    // 4. 检查格式（通用格式检查）
    const formatResults = formatChecker.checkFormat(text);
    console.log('格式检查结果:', formatResults.length, '个问题');

    // 4.1 检查模板特定格式（SY001模板）
    const templateFormatResult = sy001FormatChecker.checkFormat(text, originalName);
    let templateFormatDisplay = null;
    if (templateFormatResult.isSY001) {
      console.log('✅ 识别到SY001模板:', templateFormatResult.templateName);
      console.log('模板格式验证:', templateFormatResult.isValid ? '✅ 通过' : '❌ 未通过');
      if (templateFormatResult.errorCount > 0) {
        console.log('模板格式错误:', templateFormatResult.errorCount, '个');
      }
      if (templateFormatResult.warningCount > 0) {
        console.log('模板格式警告:', templateFormatResult.warningCount, '个');
      }
      templateFormatDisplay = sy001FormatChecker.formatResultsForDisplay(templateFormatResult);
    }

    // 5. 生成处理后的文档（保持原文档结构）
    const processedDocPath = await generateProcessedDocument(
      filePath, 
      text, 
      typoResults,
      formatResults,
      originalName,
      docInfo
    );

    // 6. 调用教学评价和修改意见智能体（仅对模板导入）
    // 优化：并行调用两个智能体，提高速度
    let teachingEvaluation = null;
    let modificationSuggestion = null;
    const templateId = parseResult.templateId || null;
    
    // 判断是否是模板导入（文件名包含模板路径或特定模板标识）
    const isTemplateImport = originalName.includes('SY001') || 
                            originalName.includes('SY002') || 
                            originalName.includes('SY003') || 
                            originalName.includes('SY004') || 
                            originalName.includes('SY005') ||
                            originalName.includes('模板');
    
    if (isTemplateImport && templateId) {
      try {
        console.log('🔍 开始并行调用教学评价和修改意见智能体...');
        console.log('⏳ 智能体分析可能需要30-60秒，请耐心等待...');
        // 并行调用两个智能体，提高速度
        const [evalResult, suggestionResult] = await Promise.allSettled([
          evaluateTeachingWithLLM(text, templateId).then(result => {
            console.log('✅ 教学评价智能体完成');
            return result;
          }),
          suggestModificationsWithLLM(text, templateId).then(result => {
            console.log('✅ 修改意见智能体完成');
            return result;
          })
        ]);
        
        // 处理教学评价结果
        if (evalResult.status === 'fulfilled') {
          teachingEvaluation = evalResult.value;
          console.log('✅ 教学评价完成');
        } else {
          console.error('❌ 教学评价智能体调用失败:', evalResult.reason);
          teachingEvaluation = {
            evaluation: `教学评价服务调用失败：${evalResult.reason?.message || '未知错误'}`,
            strengths: [],
            improvements: [],
            overall_score: 0
          };
        }
        
        // 处理修改意见结果
        if (suggestionResult.status === 'fulfilled') {
          modificationSuggestion = suggestionResult.value;
          console.log('✅ 修改意见完成');
        } else {
          console.error('❌ 修改意见智能体调用失败:', suggestionResult.reason);
          modificationSuggestion = {
            summary: `修改意见服务调用失败：${suggestionResult.reason?.message || '未知错误'}`,
            suggestions: [],
            count: 0
          };
        }
      } catch (error) {
        console.error('❌ 智能体调用失败:', error.message);
        // 不阻止流程继续，只是记录错误
        teachingEvaluation = {
          evaluation: `教学评价服务调用失败：${error.message}`,
          strengths: [],
          improvements: [],
          overall_score: 0
        };
        modificationSuggestion = {
          summary: `修改意见服务调用失败：${error.message}`,
          suggestions: [],
          count: 0
        };
      }
    }

    // 7. 登记到飞书
    const larkResult = await larkService.registerDocument({
      docNumber: docInfo.number,
      docName: docInfo.name,
      originalName: originalName,
      typoCount: typoResults.length,
      formatIssues: formatResults.length,
      reviewComments: generateReviewComments(typoResults, formatResults),
      processedDocPath: processedDocPath,
      llmTypoSummary: llmTypoSummary || formatTypoSummary(typoResults) // LLM检测结果摘要
    });

    return {
      success: true,
      documentInfo: docInfo,
      documentStructure: documentStructure, // 文档结构（用于前端显示和编辑）
      typoResults: typoResults,
      formatResults: formatResults,
      templateFormatResult: templateFormatDisplay, // 模板格式验证结果（如果是SY001模板）
      processedDocPath: processedDocPath,
      larkRecord: larkResult,
      llmTypoSummary: llmTypoSummary || (typoResults.length > 0 ? formatTypoSummary(typoResults) : null), // LLM检测结果
      llmError: llmError, // LLM错误信息（如果有）
      teachingEvaluation: teachingEvaluation, // 教学评价结果
      modificationSuggestion: modificationSuggestion, // 修改意见结果
      message: '文档处理完成并已登记到飞书'
    };
  } catch (error) {
    console.error('处理文档错误:', error);
    throw error;
  }
}

/**
 * 提取文档编号和名称
 * 规则：文件名以第一个"-"作为分隔符，前部分作为编号，后部分作为名称
 * 如果文件名不包含"-"，则编号为"-"，名称为整个文件名（去掉扩展名）
 */
function extractDocumentInfo(text, filename) {
  // 处理文件名编码问题
  let decodedFilename = filename;
  try {
    // 检查是否包含乱码特征（如 å¥ 这样的字符）
    if (/[åäöÅÄÖ]/.test(filename) && !/[\u4e00-\u9fa5]/.test(filename)) {
      // 可能是latin1编码的中文，尝试转换
      try {
        const fixed = Buffer.from(filename, 'latin1').toString('utf8');
        if (/[\u4e00-\u9fa5]/.test(fixed)) {
          decodedFilename = fixed;
          console.log('已修复文件名编码:', decodedFilename);
        }
      } catch (e) {
        // 转换失败，使用原文件名
      }
    }
  } catch (e) {
    console.warn('文件名编码处理警告:', e.message);
  }

  // 去掉文件扩展名
  const nameWithoutExt = decodedFilename.replace(/\.docx?$/i, '');
  
  // 以第一个"-"作为分隔符分割文件名
  const dashIndex = nameWithoutExt.indexOf('-');
  
  let number;
  let docName;
  
  if (dashIndex !== -1 && dashIndex > 0) {
    // 如果文件名包含"-"，则分割
    // 前部分作为编号，后部分作为名称
    number = nameWithoutExt.substring(0, dashIndex).trim();
    docName = nameWithoutExt.substring(dashIndex + 1).trim();
  } else {
    // 如果文件名不包含"-"，编号设为"-"，名称使用整个文件名
    number = '-';
    docName = nameWithoutExt;
  }

  return {
    number: number || '-',
    name: docName || nameWithoutExt
  };
}

/**
 * 生成处理后的文档（保持原文档结构，直接复制）
 */
async function generateProcessedDocument(originalPath, text, typoResults, formatResults, originalName, docInfo) {
  try {
    // 直接复制原文档，保持原有结构和格式
    const processedDir = path.join(__dirname, '../../processed');
    
    // 确保目录存在
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    // 构建新文件名：确保包含编号
    // 格式：编号-名称-时间戳.docx
    let newFileName;
    const ext = path.extname(originalName);

    // 如果文档有编号，确保文件名包含编号
    if (docInfo.number && docInfo.number !== '-') {
      // 构建文件名：编号-名称
      newFileName = `${docInfo.number}-${docInfo.name}${ext}`;
    } else {
      // 没有编号，使用原文件名
      newFileName = originalName;
    }
    
    // 添加时间戳避免重名
    const timestamp = Date.now();
    const baseName = path.basename(newFileName, ext);
    newFileName = `${baseName}-${timestamp}${ext}`;
    
    const outputPath = path.join(processedDir, newFileName);
    
    // 直接复制原文档
    fs.copyFileSync(originalPath, outputPath);

    return outputPath;
  } catch (error) {
    console.error('生成处理文档错误:', error);
    // 如果生成失败，返回原始文档路径
    return originalPath;
  }
}

/**
 * 生成评审意见文本
 */
function generateReviewComments(typoResults, formatResults) {
  const comments = [];
  
  if (typoResults.length > 0) {
    comments.push(`发现 ${typoResults.length} 个错别字：`);
    typoResults.forEach(typo => {
      comments.push(`"${typo.word}" 应改为 "${typo.correct}"`);
    });
  }

  if (formatResults.length > 0) {
    comments.push(`发现 ${formatResults.length} 个格式问题：`);
    formatResults.forEach(issue => {
      comments.push(issue.description);
    });
  }

  if (comments.length === 0) {
    comments.push('文档检查通过，未发现明显问题。');
  }

  return comments.join('\n');
}
