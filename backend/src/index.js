import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { processDocument } from './services/documentProcessor.js';
import { sy001FormatChecker } from './services/sy001FormatChecker.js';
import { generateDocumentFromStructure } from './services/documentGenerator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4004;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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

// 确保上传目录存在
import fs from 'fs';
const uploadsDir = path.join(__dirname, '../uploads');
const processedDir = path.join(__dirname, '../processed');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// 路由
app.post('/api/upload', upload.single('document'), async (req, res) => {
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

    // 自动处理文档（不需要点击处理按钮）
    const result = await processDocument(req.file.path, originalName);
    res.json(result);
  } catch (error) {
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

    // 发送文件
    const fileName = path.basename(filePath);
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('下载文件错误:', err);
        res.status(500).json({ error: '下载文件失败' });
      }
      // 下载完成后可以选择删除临时文件（可选）
      // fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('生成文档错误:', error);
    res.status(500).json({ error: error.message || '生成文档失败' });
  }
});

app.get('/api/download', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径参数' });
    }

    // 安全检查：确保文件路径在允许的目录内
    const resolvedPath = path.resolve(filePath);
    const processedDir = path.resolve(path.join(__dirname, '../processed'));
    
    if (!resolvedPath.startsWith(processedDir)) {
      return res.status(403).json({ error: '无权访问该文件' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const fileName = path.basename(resolvedPath);
    res.download(resolvedPath, fileName, (err) => {
      if (err) {
        console.error('下载文件错误:', err);
        res.status(500).json({ error: '下载文件失败' });
      }
    });
  } catch (error) {
    console.error('下载错误:', error);
    res.status(500).json({ error: error.message || '下载文件时出错' });
  }
});

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

    // 复制模板文件到uploads目录（模拟上传）
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const copiedFilePath = path.join(uploadsDir, `template-${timestamp}-${filename}`);
    fs.copyFileSync(filePath, copiedFilePath);

    // 处理文档（使用模板文件名作为原始文件名）
    const result = await processDocument(copiedFilePath, filename);
    
    res.json(result);
  } catch (error) {
    console.error('导入模板错误:', error);
    res.status(500).json({ error: error.message || '导入模板时出错' });
  }
});

app.post('/api/sync-review', async (req, res) => {
  try {
    const { recordId, teachingEvaluation, modificationComments } = req.body;

    if (!recordId) {
      return res.status(400).json({ 
        success: false,
        error: '缺少记录ID' 
      });
    }

    if (teachingEvaluation === undefined && modificationComments === undefined) {
      return res.status(400).json({ 
        success: false,
        error: '请至少填写教学评价或修改意见' 
      });
    }

    const { larkService } = await import('./services/larkService.js');
    const result = await larkService.syncReview(recordId, teachingEvaluation, modificationComments);

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

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
});
