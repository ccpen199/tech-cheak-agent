/**
 * 应用统一配置管理
 * 管理所有路径、环境变量和依赖配置
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录（backend目录的父目录）
const PROJECT_ROOT = path.join(__dirname, '../../..');
const BACKEND_ROOT = path.join(__dirname, '../..');

/**
 * 加载环境变量
 * 按优先级加载：backend/.env > 项目根目录/.env
 */
function loadEnvironmentVariables() {
  const backendEnvPath = path.join(BACKEND_ROOT, '.env');
  const rootEnvPath = path.join(PROJECT_ROOT, '.env');
  
  // 优先加载backend/.env
  if (fs.existsSync(backendEnvPath)) {
    const result = dotenv.config({ path: backendEnvPath });
    if (result.error) {
      console.warn('⚠️  加载backend/.env失败:', result.error);
    } else {
      console.log('✅ 已加载环境变量: backend/.env');
    }
  }
  
  // 如果backend/.env不存在，尝试加载项目根目录的.env
  if (!fs.existsSync(backendEnvPath) && fs.existsSync(rootEnvPath)) {
    const result = dotenv.config({ path: rootEnvPath });
    if (result.error) {
      console.warn('⚠️  加载项目根目录.env失败:', result.error);
    } else {
      console.log('✅ 已加载环境变量: 项目根目录/.env');
    }
  }
  
  // 如果都不存在，尝试默认位置
  if (!fs.existsSync(backendEnvPath) && !fs.existsSync(rootEnvPath)) {
    dotenv.config(); // 默认从当前工作目录加载
  }
}

// 初始化时加载环境变量
loadEnvironmentVariables();

/**
 * 获取Python可执行文件路径
 * 优先级：llm/venv/bin/python > backend/services/venv/bin/python > 系统python3
 */
function getPythonCommand() {
  if (process.platform === 'darwin') {
    // macOS: 使用Homebrew的Python
    const homebrewPython = '/opt/homebrew/opt/python@3.12/bin/python3.12';
    if (fs.existsSync(homebrewPython)) {
      return homebrewPython;
    }
    return 'python3';
  } else {
    // Linux: 优先使用虚拟环境中的Python
    const llmVenvPython = path.join(PROJECT_ROOT, 'llm/venv/bin/python');
    if (fs.existsSync(llmVenvPython)) {
      return llmVenvPython;
    }
    
    // 尝试backend/services的虚拟环境
    const backendVenvPython = path.join(BACKEND_ROOT, 'services/venv/bin/python');
    if (fs.existsSync(backendVenvPython)) {
      return backendVenvPython;
    }
    
    // 最后使用系统Python
    return 'python3';
  }
}

/**
 * 应用配置
 */
export const appConfig = {
  // 项目路径
  paths: {
    projectRoot: PROJECT_ROOT,
    backendRoot: BACKEND_ROOT,
    llmDir: path.join(PROJECT_ROOT, 'llm'),
    servicesDir: path.join(BACKEND_ROOT, 'services'),
    docxModelsDir: path.join(PROJECT_ROOT, 'docx/models'),
  },
  
  // Python配置
  python: {
    command: getPythonCommand(),
    llmDir: path.join(PROJECT_ROOT, 'llm'),
    venvPath: path.join(PROJECT_ROOT, 'llm/venv'),
  },
  
  // Python脚本路径
  scripts: {
    cosUploader: path.join(BACKEND_ROOT, 'services/cosUploader.py'),
    teachingEvaluation: path.join(PROJECT_ROOT, 'llm/agents/teaching_evaluation_api.py'),
    modificationSuggestion: path.join(PROJECT_ROOT, 'llm/agents/modification_suggestion_api.py'),
    typoCheck: path.join(PROJECT_ROOT, 'llm/agents/typo_check_api.py'),
  },
  
  // 环境变量（从process.env读取）
  env: {
    // 服务器配置
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // 飞书配置
    larkAppId: process.env.LARK_APP_ID,
    larkAppSecret: process.env.LARK_APP_SECRET,
    larkAppToken: process.env.LARK_APP_TOKEN,
    
    // COS配置
    cosSecretId: process.env.COS_SECRET_ID,
    cosSecretKey: process.env.COS_SECRET_KEY,
    cosRegion: process.env.COS_REGION || 'ap-chengdu',
    cosBucketName: process.env.COS_BUCKET_NAME,
    cosBaseUrl: process.env.COS_BASE_URL,
    
    // LLM配置（Python环境变量）
    modelscopeApiKey: process.env.MODELSCOPE_API_KEY,
    modelscopeApiBase: process.env.MODELSCOPE_API_BASE,
    modelscopeTextModels: process.env.MODELSCOPE_TEXT_MODELS,
  },
  
  // 依赖配置
  dependencies: {
    // Node.js依赖（在package.json中）
    nodeDependencies: path.join(BACKEND_ROOT, 'package.json'),
    
    // Python依赖（统一管理）
    pythonRequirements: path.join(PROJECT_ROOT, 'requirements.txt'),
    // 保留旧路径作为兼容（已废弃，使用上面的统一文件）
    llmRequirements: path.join(PROJECT_ROOT, 'llm/requirements.txt'),
    servicesRequirements: path.join(BACKEND_ROOT, 'services/requirements.txt'),
  },
};

/**
 * 验证配置
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];
  
  // 检查Python命令
  if (!fs.existsSync(appConfig.python.command) && appConfig.python.command !== 'python3') {
    warnings.push(`Python命令不存在: ${appConfig.python.command}，将使用系统python3`);
  }
  
  // 检查必要的环境变量
  if (!appConfig.env.larkAppId) {
    warnings.push('LARK_APP_ID 未设置');
  }
  if (!appConfig.env.larkAppSecret) {
    warnings.push('LARK_APP_SECRET 未设置');
  }
  
  // 检查Python脚本
  if (!fs.existsSync(appConfig.scripts.cosUploader)) {
    warnings.push(`COS上传脚本不存在: ${appConfig.scripts.cosUploader}`);
  }
  if (!fs.existsSync(appConfig.scripts.teachingEvaluation)) {
    warnings.push(`教学评价脚本不存在: ${appConfig.scripts.teachingEvaluation}`);
  }
  if (!fs.existsSync(appConfig.scripts.modificationSuggestion)) {
    warnings.push(`修改建议脚本不存在: ${appConfig.scripts.modificationSuggestion}`);
  }
  if (!fs.existsSync(appConfig.scripts.typoCheck)) {
    warnings.push(`错别字检测脚本不存在: ${appConfig.scripts.typoCheck}`);
  }
  
  return { errors, warnings };
}

// 启动时验证配置
const validation = validateConfig();
if (validation.errors.length > 0) {
  console.error('❌ 配置验证失败:');
  validation.errors.forEach(err => console.error('  -', err));
}
if (validation.warnings.length > 0) {
  console.warn('⚠️  配置警告:');
  validation.warnings.forEach(warn => console.warn('  -', warn));
}

// 输出配置信息（仅关键信息）
console.log('📋 应用配置:');
console.log(`  Python命令: ${appConfig.python.command}`);
console.log(`  服务端口: ${appConfig.env.port}`);
console.log(`  LLM目录: ${appConfig.paths.llmDir}`);
console.log(`  虚拟环境: ${appConfig.python.venvPath} ${fs.existsSync(appConfig.python.venvPath) ? '✅' : '❌'}`);

export default appConfig;

