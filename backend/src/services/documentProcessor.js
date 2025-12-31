import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import os from 'os';
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

    // 2. 提取文档编号和名称（优先从文档结构中提取，否则从文件名提取）
    const docInfo = extractDocumentInfo(text, originalName, documentStructure);
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

    // 7. 格式化教学评价和修改意见（用于飞书同步）
    let formattedTeachingEvaluation = '';
    if (teachingEvaluation) {
      const evaluation = teachingEvaluation;
      let evalText = '';
      if (evaluation.evaluation) {
        evalText += `【总体评价】\n${evaluation.evaluation}\n\n`;
      }
      if (evaluation.strengths && evaluation.strengths.length > 0) {
        evalText += `【优点】\n${evaluation.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
      }
      if (evaluation.improvements && evaluation.improvements.length > 0) {
        evalText += `【改进建议】\n${evaluation.improvements.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
      }
      if (evaluation.overall_score) {
        evalText += `【综合评分】${evaluation.overall_score}/10分`;
      }
      formattedTeachingEvaluation = evalText.trim();
    }

    let formattedModificationComments = '';
    if (modificationSuggestion) {
      const suggestion = modificationSuggestion;
      let suggestionText = '';
      if (suggestion.summary) {
        suggestionText += `【总体建议】\n${suggestion.summary}\n\n`;
      }
      if (suggestion.suggestions && suggestion.suggestions.length > 0) {
        suggestionText += `【具体修改建议】\n`;
        suggestion.suggestions.forEach((s, i) => {
          suggestionText += `${i + 1}. ${s}\n`;
        });
      }
      formattedModificationComments = suggestionText.trim();
    }
    
    // 如果没有智能体生成的修改意见，使用传统的评审意见
    if (!formattedModificationComments) {
      formattedModificationComments = generateReviewComments(typoResults, formatResults);
    }

    // 从文档结构中提取作者信息
    let author = '';
    if (documentStructure && documentStructure.sections) {
      console.log('[DocumentProcessor] 正在提取作者信息...');
      documentStructure.sections.forEach(section => {
        if (section.type === 'basic_info' && section.fields) {
          console.log('[DocumentProcessor] 基本信息字段:', section.fields.map(f => `${f.name}="${f.value || '(空)'}"`).join(', '));
          section.fields.forEach(field => {
            if (field.name === '作者') {
              console.log(`[DocumentProcessor] 找到作者字段: "${field.value || '(空)'}"`);
              if (field.value) {
                author = field.value.trim();
                console.log(`[DocumentProcessor] 提取到作者: "${author}"`);
              }
            }
          });
        }
      });
    }
    console.log(`[DocumentProcessor] 最终提取的作者: "${author || '未提供'}"`);

    // 7. 登记到飞书
    const larkResult = await larkService.registerDocument({
      docNumber: docInfo.number,
      docName: docInfo.name,
      author: author,
      originalName: originalName,
      typoCount: typoResults.length,
      formatIssues: formatResults.length,
      reviewComments: formattedModificationComments,
      teachingEvaluation: formattedTeachingEvaluation,
      processedDocPath: processedDocPath,
      llmTypoSummary: llmTypoSummary || formatTypoSummary(typoResults) // LLM检测结果摘要
    });

    // 生成缓存key（用于LLM结果缓存，如果需要的话）
    const cacheKey = `${docInfo.number}-${docInfo.name}`;

    return {
      success: true,
      documentInfo: docInfo,
      documentStructure: documentStructure, // 文档结构（用于前端显示和编辑）
      typoResults: typoResults,
      formatResults: formatResults,
      templateFormatResult: templateFormatDisplay, // 模板格式验证结果（如果是SY001模板）
      processedDocPath: processedDocPath,
      originalDocPath: filePath, // 原始文档路径（用于刷新时重新读取）
      originalText: text, // 原始文档文本（用于刷新LLM分析）
      larkRecord: larkResult,
      llmTypoSummary: llmTypoSummary || (typoResults.length > 0 ? formatTypoSummary(typoResults) : null), // LLM检测结果
      llmError: llmError, // LLM错误信息（如果有）
      teachingEvaluation: teachingEvaluation, // 教学评价结果
      modificationSuggestion: modificationSuggestion, // 修改意见结果
      llmPending: false, // 现在是同步处理，不需要pending标记
      llmCacheKey: cacheKey, // 用于后续获取LLM结果的key（如果需要）
      message: '文档处理完成并已登记到飞书'
    };
  } catch (error) {
    console.error('处理文档错误:', error);
    throw error;
  }
}

/**
 * 提取文档编号和名称
 * 优先从文档结构的基本信息中提取（课程编号、活动名称/课程名称）
 * 如果提取不到，则从文件名提取（以第一个"-"作为分隔符）
 */
function extractDocumentInfo(text, filename, documentStructure = null) {
  let number = null;
  let docName = null;
  
  // 优先从文档结构的基本信息中提取
  if (documentStructure && documentStructure.sections) {
    documentStructure.sections.forEach(section => {
      if (section.type === 'basic_info' && section.fields) {
        section.fields.forEach(field => {
          // 提取课程编号
          if (field.name === '课程编号' && !number && field.value) {
            number = field.value.trim();
          }
          // 提取活动名称（SY001）或课程名称（其他模板）
          if ((field.name === '活动名称' || field.name === '课程名称') && !docName && field.value) {
            docName = field.value.trim();
          }
          // SY004使用绘本名称
          if (field.name === '绘本名称' && !docName && field.value) {
            docName = field.value.trim();
          }
        });
      }
    });
  }
  
  // 如果从文档结构中提取到了，直接返回
  if (number && docName) {
    return {
      number: number,
      name: docName
    };
  }
  
  // 如果提取不到，从文件名提取（作为备选方案）
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
  
  // 如果从文档结构中没有提取到，使用文件名提取的结果
  if (!number) {
    if (dashIndex !== -1 && dashIndex > 0) {
      number = nameWithoutExt.substring(0, dashIndex).trim();
    } else {
      number = '-';
    }
  }
  
  if (!docName) {
    if (dashIndex !== -1 && dashIndex > 0) {
      docName = nameWithoutExt.substring(dashIndex + 1).trim();
    } else {
      docName = nameWithoutExt;
    }
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
    // 使用系统临时目录（不使用本地缓存）
    const tempDir = os.tmpdir();
    
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
    
    const outputPath = path.join(tempDir, newFileName);
    
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
