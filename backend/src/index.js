import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
// 使用统一配置（会自动加载环境变量）
import appConfig from './config/appConfig.js';
import { processDocument } from './services/documentProcessor.js';
import { sy001FormatChecker } from './services/sy001FormatChecker.js';
import { generateDocumentFromStructure } from './services/documentGenerator.js';
import { uploadToCOS } from './services/cosService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = appConfig.env.port;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置multer用于文件上传
// 使用内存存储，不缓存文件到本地
const storage = multer.memoryStorage();

// 注释掉磁盘存储（不再缓存文件到 uploads 目录）
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, '../uploads/'));
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .doc 和 .docx 格式的文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 注释掉上传目录创建（不再使用本地缓存）
import fs from 'fs';
// const uploadsDir = path.join(__dirname, '../uploads');
// // 不再使用本地缓存目录
// // const processedDir = path.join(__dirname, '../processed');
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }
// // 注释掉processed目录创建
// // if (!fs.existsSync(processedDir)) {
// //   fs.mkdirSync(processedDir, { recursive: true });
// // }

// 路由
app.post('/api/upload', upload.single('document'), async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    // 确保文件名正确解码（处理中文文件名编码问题）
    let originalName = req.file.originalname;
    try {
      // 如果文件名是乱码，尝试从buffer解码
      if (Buffer.from(originalName, 'utf8').toString('utf8') !== originalName) {
        // 尝试其他编码方式
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      }
    } catch (e) {
      // 如果解码失败，使用原始文件名
      console.warn('文件名解码警告:', e.message);
    }

    // 使用内存存储，将文件保存到临时目录（处理完后删除，不缓存）
    const tempDir = os.tmpdir();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    tempFilePath = path.join(tempDir, `upload-${uniqueSuffix}${path.extname(originalName)}`);
    
    // 将buffer写入临时文件
    fs.writeFileSync(tempFilePath, req.file.buffer);
    
    // 自动处理文档（不需要点击处理按钮）
    const result = await processDocument(tempFilePath, originalName);
    
    // 处理完成后删除临时文件（不缓存）
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('已删除临时上传文件:', tempFilePath);
    }
    
    res.json(result);
  } catch (error) {
    // 确保在出错时也删除临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('错误处理：已删除临时上传文件:', tempFilePath);
      } catch (unlinkError) {
        console.warn('删除临时文件失败:', unlinkError.message);
      }
    }
    console.error('上传处理错误:', error);
    res.status(500).json({ error: error.message || '处理文档时出错' });
  }
});

// 实时验证格式API
app.post('/api/validate-format', async (req, res) => {
  try {
    const { structure, templateId } = req.body;
    
    if (!structure) {
      return res.status(400).json({ error: '缺少文档结构数据' });
    }

    // 将结构转换为文本进行验证
    const text = structureToText(structure);
    
    // 验证格式
    let formatResult = null;
    if (templateId === 'SY001') {
      const result = sy001FormatChecker.checkFormat(text, 'SY001');
      formatResult = sy001FormatChecker.formatResultsForDisplay(result);
    }

    res.json({
      success: true,
      formatResult: formatResult
    });
  } catch (error) {
    console.error('格式验证错误:', error);
    res.status(500).json({ error: error.message || '格式验证失败' });
  }
});

// 将结构转换为文本
function structureToText(structure) {
  const lines = [];
  
  if (structure.sections) {
    structure.sections.forEach(section => {
      if (section.type === 'basic_info' && section.fields) {
        section.fields.forEach(field => {
          lines.push(`${field.name}\t${field.value || ''}`);
        });
      }
      
      if (section.type === 'segments' && section.items) {
        lines.push('环节流程');
        section.items.forEach(segment => {
          lines.push(`环节${segment.number}：${segment.title}\t${segment.time || ''}分钟`);
          lines.push('操作方法：');
          if (segment.method.items) {
            segment.method.items.forEach(item => {
              lines.push(`${item.number}. ${item.content || ''}`);
            });
          }
          lines.push('主/助教分工：');
          lines.push(segment.division.value || '');
          lines.push('教师指导语：');
          if (segment.guidance.items) {
            segment.guidance.items.forEach(item => {
              lines.push(`${item.number}. ${item.content || ''}`);
            });
          }
        });
      }
    });
  }
  
  return lines.join('\n');
}

// 生成编辑后的文档
app.post('/api/generate-document', async (req, res) => {
  try {
    const { structure, templateId, templateName, documentInfo, originalTemplateFilename } = req.body;

    if (!structure) {
      return res.status(400).json({ error: '缺少文档结构数据' });
    }

    // 从templateId中提取模版ID（可能是完整文件名如 "SY004-童萌-绘本剧模板.docx" 或直接是 "SY004"）
    let extractedTemplateId = templateId;
    if (templateId?.startsWith('SY004')) {
      extractedTemplateId = 'SY004';
    } else if (templateId?.startsWith('SY002')) {
      extractedTemplateId = 'SY002';
    } else if (templateId?.startsWith('SY005')) {
      extractedTemplateId = 'SY005';
    } else if (templateId?.startsWith('SY003')) {
      extractedTemplateId = 'SY003';
    } else if (templateId?.startsWith('SY001')) {
      extractedTemplateId = 'SY001';
    }
    
    console.log('生成文档 - templateId:', templateId, 'extractedTemplateId:', extractedTemplateId);

    // 获取原始模板路径（如果提供）
    let originalTemplatePath = null;
    if (originalTemplateFilename && templateId) {
      const templatePath = path.join(templatesDir, originalTemplateFilename);
      if (fs.existsSync(templatePath)) {
        originalTemplatePath = templatePath;
        console.log('使用原始模板路径:', originalTemplatePath);
      } else {
        console.warn('原始模板文件不存在:', templatePath);
      }
    }

    // 生成Word文档
    const filePath = await generateDocumentFromStructure(structure, extractedTemplateId, documentInfo, originalTemplatePath);

    // 生成文件名：优先从文档结构（前端编辑后的内容）中提取课程编号和名称
    let fileName = path.basename(filePath);
    let cosFileName = null; // COS上传时使用的文件名
    
    // 优先从structure中提取（这是前端编辑后的最新内容）
    let courseNumber = '';
    let courseName = '';
    
    if (structure?.sections) {
      structure.sections.forEach(section => {
        if (section.type === 'basic_info' && section.fields) {
          section.fields.forEach(field => {
            // 过滤无效值：空字符串、"(空)"、null、undefined
            const value = field.value ? field.value.trim() : '';
            const isValidValue = value && value !== '' && value !== '(空)' && value !== '（空）';
            
            // 提取课程编号
            if (field.name === '课程编号' && isValidValue) {
              courseNumber = value;
            }
            // SY001、SY003使用"活动名称"，其他使用"课程名称"，SY004使用"绘本名称"
            if (field.name === '活动名称' && isValidValue) {
              courseName = value;
            }
            if (field.name === '课程名称' && isValidValue) {
              courseName = value;
            }
            if (field.name === '绘本名称' && isValidValue) {
              courseName = value;
            }
          });
        }
      });
    }
    
    // 如果从structure中提取不到，再使用documentInfo（作为备选）
    if (!courseNumber && documentInfo?.number) {
      courseNumber = documentInfo.number;
    }
    // 注意：documentInfo.name可能是模板名称（如"童萌-食育课模板"），不是真正的课程名称
    // 所以只有当structure中确实没有课程名称时，才考虑使用documentInfo.name
    // 但我们需要确保不使用模板名称作为课程名称
    if (!courseName && documentInfo?.name) {
      // 检查documentInfo.name是否看起来像模板名称（包含"模板"、"模版"等字样）
      const templateNamePattern = /(模板|模版|template)/i;
      if (!templateNamePattern.test(documentInfo.name)) {
        courseName = documentInfo.name;
      }
    }
    
    // 生成COS文件名（编号-名称格式，只使用必要信息，不包含时间戳等）
    // 确保文件名格式与浏览器下载的文件名一致
    if (courseNumber && courseName) {
      cosFileName = `${courseNumber}-${courseName}.docx`;
    } else if (courseNumber) {
      // 只有编号，没有名称
      cosFileName = `${courseNumber}.docx`;
    } else if (courseName) {
      // 只有名称，没有编号
      cosFileName = `${courseName}.docx`;
    } else {
      // 都没有，使用时间戳避免冲突（但不推荐）
      const timestamp = Date.now();
      cosFileName = `document-${timestamp}.docx`;
      console.warn('[生成文档] 警告：无法提取课程编号和名称，使用时间戳文件名');
    }
    
    // 调试日志：输出提取到的信息
    console.log('[生成文档] 提取到的课程编号:', courseNumber || '(空)');
    console.log('[生成文档] 提取到的课程名称:', courseName || '(空)');
    console.log('[生成文档] COS文件名:', cosFileName);

    // 上传到COS并获取下载链接
    let downloadUrl = null;
    try {
      console.log('开始上传文档到COS...');
      // 使用生成的cosFileName作为object_key（不包含时间戳，只使用必要信息）
      const objectKey = `documents/${cosFileName}`;
      console.log('[生成文档] COS object_key:', objectKey);
      
      const cosResult = await uploadToCOS(filePath, objectKey);
      if (cosResult.success) {
        downloadUrl = cosResult.download_url;
        console.log('✅ 文档已上传到COS，下载链接:', downloadUrl);
      } else {
        console.warn('⚠️ COS上传失败:', cosResult.error);
        // 上传失败不影响文档下载，继续返回文件
      }
    } catch (error) {
      console.error('COS上传错误:', error.message);
      // 上传失败不影响文档下载，继续返回文件
    }

    // 读取文件内容，准备返回给前端下载
    const fileBuffer = fs.readFileSync(filePath);
    
    // 检查是否请求JSON格式（用于获取下载链接）
    const wantsJson = req.query.format === 'json';
    
    // 上传到COS后，删除临时文件（如果文件在临时目录中）
    // 注意：只删除系统临时目录中的文件，不影响其他文件
    const tempDir = os.tmpdir();
    const shouldDeleteTempFile = filePath.startsWith(tempDir);
    
    if (wantsJson) {
      // 返回JSON响应（用于前端获取下载链接，不重复生成文档）
      res.json({
        success: true,
        filePath: filePath,
        fileName: fileName,
        downloadUrl: downloadUrl, // COS下载链接
        message: downloadUrl ? '文档已生成并上传到COS' : '文档已生成（COS上传失败）'
      });
      
      // 响应完成后删除临时文件
      if (shouldDeleteTempFile) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.warn('删除临时文件失败:', err.message);
          } else {
            console.log('已删除临时文件:', filePath);
          }
        });
      }
    } else {
      // 返回文件（用于浏览器下载）
      // 在响应头中添加下载链接和文件名信息
      // 注意：响应头中不能包含中文字符，需要对URL进行编码
      if (downloadUrl) {
        // 使用encodeURIComponent编码URL，因为URL中可能包含中文字符（文件名）
        res.setHeader('X-Download-Url', encodeURIComponent(downloadUrl));
      }
      res.setHeader('X-File-Name', encodeURIComponent(fileName));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(fileBuffer);
      
      // 响应完成后删除临时文件
      if (shouldDeleteTempFile) {
        res.on('finish', () => {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.warn('删除临时文件失败:', err.message);
            } else {
              console.log('已删除临时文件:', filePath);
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('生成文档错误:', error);
    res.status(500).json({ error: error.message || '生成文档失败' });
  }
});

// 注释掉下载接口：不再使用本地缓存，文件通过generate-document接口直接返回
// app.get('/api/download', (req, res) => {
//   try {
//     const filePath = req.query.path;
//     if (!filePath) {
//       return res.status(400).json({ error: '缺少文件路径参数' });
//     }
//
//     // 不再使用本地缓存，文件通过generate-document接口直接返回
//     // 安全检查：确保文件路径在允许的目录内（临时文件或processed目录）
//     // const resolvedPath = path.resolve(filePath);
//     // const processedDir = path.resolve(path.join(__dirname, '../processed'));
//     // 
//     // if (!resolvedPath.startsWith(processedDir)) {
//     //   return res.status(403).json({ error: '无权访问该文件' });
//     // }
//
//     if (!fs.existsSync(resolvedPath)) {
//       return res.status(404).json({ error: '文件不存在' });
//     }
//
//     const fileName = path.basename(resolvedPath);
//     res.download(resolvedPath, fileName, (err) => {
//       if (err) {
//         console.error('下载文件错误:', err);
//         res.status(500).json({ error: '下载文件失败' });
//       }
//     });
//   } catch (error) {
//     console.error('下载错误:', error);
//     res.status(500).json({ error: error.message || '下载文件时出错' });
//   }
// });

// 模板目录路径
const templatesDir = path.join(__dirname, '../../docx/models');

// 获取模板列表
app.get('/api/templates', (req, res) => {
  try {
    if (!fs.existsSync(templatesDir)) {
      return res.json({ templates: [] });
    }

    const files = fs.readdirSync(templatesDir);
    const templates = files
      .filter(file => file.endsWith('.docx') && !file.includes(' (1)')) // 排除重复文件
      .map(file => {
        const filePath = path.join(templatesDir, file);
        const stats = fs.statSync(filePath);
        return {
          id: file,
          name: file.replace('.docx', ''),
          filename: file,
          size: stats.size,
          modified: stats.mtime
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    res.json({ templates });
  } catch (error) {
    console.error('获取模板列表错误:', error);
    res.status(500).json({ error: '获取模板列表失败' });
  }
});

// 下载模板（保留用于兼容）
app.get('/api/templates/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: '无效的文件名' });
    }

    const filePath = path.join(templatesDir, filename);
    
    // 确保文件在模板目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedTemplatesDir = path.resolve(templatesDir);
    
    if (!resolvedPath.startsWith(resolvedTemplatesDir)) {
      return res.status(403).json({ error: '无权访问该文件' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '模板文件不存在' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('下载模板错误:', err);
        res.status(500).json({ error: '下载模板失败' });
      }
    });
  } catch (error) {
    console.error('下载模板错误:', error);
    res.status(500).json({ error: error.message || '下载模板时出错' });
  }
});

// 导入模板并自动处理
app.post('/api/import-template', async (req, res) => {
  try {
    const { templateId, filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: '缺少模板文件名' });
    }

    // 安全检查
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: '无效的文件名' });
    }

    const filePath = path.join(templatesDir, filename);
    
    // 确保文件在模板目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedTemplatesDir = path.resolve(templatesDir);
    
    if (!resolvedPath.startsWith(resolvedTemplatesDir)) {
      return res.status(403).json({ error: '无权访问该文件' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '模板文件不存在' });
    }

    // 注释掉：不再复制模板文件到uploads目录（不缓存）
    // 直接使用模板文件路径处理，处理完后不删除模板文件（模板文件是系统资源）
    // const uploadsDir = path.join(__dirname, '../uploads');
    // if (!fs.existsSync(uploadsDir)) {
    //   fs.mkdirSync(uploadsDir, { recursive: true });
    // }
    // 
    // const timestamp = Date.now();
    // const copiedFilePath = path.join(uploadsDir, `template-${timestamp}-${filename}`);
    // fs.copyFileSync(filePath, copiedFilePath);

    // 直接处理模板文件（模板文件是系统资源，不需要缓存）
    const result = await processDocument(filePath, filename);
    
    res.json(result);
  } catch (error) {
    console.error('导入模板错误:', error);
    res.status(500).json({ error: error.message || '导入模板时出错' });
  }
});

app.post('/api/sync-review', async (req, res) => {
  try {
    const { recordId, teachingEvaluation, modificationComments, typoInfo, docNumber, docName, author, downloadUrl } = req.body;

    if (!recordId) {
      return res.status(400).json({ 
        success: false,
        error: '缺少记录ID' 
      });
    }

    if (teachingEvaluation === undefined && modificationComments === undefined && typoInfo === undefined) {
      return res.status(400).json({ 
        success: false,
        error: '请至少填写教学评价、修改意见或错别字信息' 
      });
    }

    const { larkService } = await import('./services/larkService.js');
    const result = await larkService.syncReview(recordId, teachingEvaluation, modificationComments, typoInfo, docNumber, docName, author, downloadUrl);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('同步评价错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || '同步失败，请重试' 
    });
  }
});

// 重新执行错别字检测
app.post('/api/refresh-typo-check', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: '缺少文本内容' 
      });
    }

    const { checkTyposWithLLM, formatTypoSummary } = await import('./services/llmTypoChecker.js');
    
    console.log('[刷新] 重新执行错别字检测，文本长度:', text.length);
    const llmResults = await checkTyposWithLLM(text);
    
    console.log('[刷新] 错别字检测服务返回结果类型:', Array.isArray(llmResults) ? 'Array' : typeof llmResults);
    
    let typos = [];
    let llmSuccess = false;
    
    if (Array.isArray(llmResults)) {
      typos = llmResults;
      llmSuccess = true;
    } else if (llmResults && typeof llmResults === 'object') {
      typos = llmResults.typos || [];
      llmSuccess = llmResults.llm_success !== false;
    }
    
    const llmTypoSummary = llmSuccess && typos.length > 0 
      ? formatTypoSummary(typos) 
      : (llmSuccess ? '未发现错别字（LLM智能检测）' : null);
    
    console.log('[刷新] 错别字检测结果：llmSuccess=', llmSuccess, 'typos数量=', typos.length);
    
    res.json({
      success: true,
      typoResults: typos,
      llmTypoSummary: llmTypoSummary,
      llmError: llmSuccess ? null : 'LLM检测失败',
      count: typos.length
    });
  } catch (error) {
    console.error('重新执行错别字检测错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || '重新执行错别字检测失败' 
    });
  }
});

// 重新执行教学评价
app.post('/api/refresh-teaching-evaluation', async (req, res) => {
  try {
    const { text, templateId, customPrompt } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: '缺少文本内容' 
      });
    }

    const { evaluateTeachingWithLLM } = await import('./services/teachingEvaluationService.js');
    
    console.log('[刷新] 重新执行教学评价，文本长度:', text.length, customPrompt ? '使用自定义提示词' : '使用默认提示词');
    const teachingEvaluation = await evaluateTeachingWithLLM(text, templateId, customPrompt);
    
    res.json({
      success: true,
      teachingEvaluation: teachingEvaluation
    });
  } catch (error) {
    console.error('重新执行教学评价错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || '重新执行教学评价失败' 
    });
  }
});

// 重新执行修改意见
app.post('/api/refresh-modification-suggestion', async (req, res) => {
  try {
    const { text, templateId, customPrompt } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: '缺少文本内容' 
      });
    }

    const { suggestModificationsWithLLM } = await import('./services/modificationSuggestionService.js');
    
    console.log('[刷新] 重新执行修改意见，文本长度:', text.length, customPrompt ? '使用自定义提示词' : '使用默认提示词');
    const modificationSuggestion = await suggestModificationsWithLLM(text, templateId, customPrompt);
    
    console.log('[刷新] 修改意见服务返回结果:');
    console.log('  - summary:', modificationSuggestion?.summary || '无');
    console.log('  - suggestions数量:', modificationSuggestion?.suggestions?.length || 0);
    console.log('  - 完整对象:', JSON.stringify(modificationSuggestion).substring(0, 200));
    
    res.json({
      success: true,
      modificationSuggestion: modificationSuggestion
    });
  } catch (error) {
    console.error('重新执行修改意见错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || '重新执行修改意见失败' 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// 提供静态文件服务（前端构建产物）- 必须在所有 API 路由之后
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  // 所有非 API 路由都返回前端应用
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // 如果没有前端构建产物，提供一个简单的首页
  app.get('/', (req, res) => {
    res.json({ 
      message: '教案评审系统后端 API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        upload: '/api/upload',
        templates: '/api/templates'
      }
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`后端服务运行在 http://0.0.0.0:${PORT}`);
});
