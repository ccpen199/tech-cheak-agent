/**
 * 基于LLM的错别字检测服务
 * 调用Python智能体进行错别字检测
 */

import { spawn } from 'child_process';
import fs from 'fs';
import appConfig from '../config/appConfig.js';

/**
 * 调用Python智能体检测错别字
 * @param {string} text - 要检测的文本内容
 * @returns {Promise<Array>} 错别字结果数组
 */
export async function checkTyposWithLLM(text) {
  return new Promise((resolve, reject) => {
    try {
      // 使用统一配置获取Python脚本路径
      const apiScript = appConfig.scripts.typoCheck;
      const llmDir = appConfig.python.llmDir;
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(apiScript)) {
        console.warn(`⚠️  Python智能体脚本不存在: ${apiScript}，使用传统方法`);
        resolve([]);
        return;
      }
      
      // 检查Python是否可用
      const pythonCommand = appConfig.python.command;
      const pythonCheck = spawn(pythonCommand, ['--version']);
      pythonCheck.on('error', () => {
        console.warn(`⚠️  Python未安装或不可用: ${pythonCommand}，使用传统方法`);
        resolve([]);
      });
      pythonCheck.on('close', (code) => {
        if (code !== 0) {
          console.warn('⚠️  Python检查失败，使用传统方法');
          resolve([]);
        }
      });
      
      // 使用统一配置的Python命令
      const pythonProcess = spawn(pythonCommand, [apiScript], {
        cwd: llmDir,
        env: { ...process.env, PYTHONPATH: llmDir }
      });
      
      // 将文本写入标准输入
      pythonProcess.stdin.write(text, 'utf8');
      pythonProcess.stdin.end();

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          // 检查是否是依赖缺失错误
          if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
            console.error('');
            console.error('❌ ============================================');
            console.error('❌ Python依赖未安装！');
            console.error('❌ ============================================');
            console.error('');
            console.error('请运行以下命令安装依赖:');
            console.error('  cd llm && ./install.sh');
            console.error('或者:');
            console.error('  cd llm && pip install -r requirements.txt');
            console.error('');
            console.error('错误详情:', stderr.substring(0, 300));
            console.error('');
          } else {
            console.error('Python脚本执行失败:', stderr.substring(0, 500));
          }
          resolve([]);
          return;
        }

        try {
          // 合并stdout和stderr（因为LiteLLM可能把错误输出到stdout）
          // 与教学评价服务保持一致
          let allOutput = stdout + stderr;
          
          // 改进的JSON提取：优先从stdout的第一个{开始提取（JSON通常在stdout开头）
          let jsonStr = null;
          
          // 方法1：优先从stdout的第一个{开始提取（因为JSON通常在stdout开头）
          const stdoutFirstBraceIdx = stdout.indexOf('{');
          if (stdoutFirstBraceIdx !== -1) {
            let braceCount = 0;
            let endIdx = stdoutFirstBraceIdx;
            for (let i = stdoutFirstBraceIdx; i < stdout.length; i++) {
              if (stdout[i] === '{') braceCount++;
              if (stdout[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  endIdx = i;
                  break;
                }
              }
            }
            if (endIdx > stdoutFirstBraceIdx) {
              jsonStr = stdout.substring(stdoutFirstBraceIdx, endIdx + 1);
            }
          }
          
          // 方法2：如果方法1失败，尝试从合并输出的第一个{开始提取
          if (!jsonStr) {
            const startIdx = allOutput.indexOf('{');
            if (startIdx !== -1) {
              let braceCount = 0;
              let endIdx = startIdx;
              for (let i = startIdx; i < allOutput.length; i++) {
                if (allOutput[i] === '{') braceCount++;
                if (allOutput[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    endIdx = i;
                    break;
                  }
                }
              }
              if (endIdx > startIdx) {
                jsonStr = allOutput.substring(startIdx, endIdx + 1);
              }
            }
          }
          
          // 方法3：如果前两个方法都失败，尝试从最后一个{开始提取
          if (!jsonStr) {
            const lastBraceIdx = allOutput.lastIndexOf('{');
            if (lastBraceIdx !== -1) {
              let braceCount = 0;
              let endIdx = lastBraceIdx;
              for (let i = lastBraceIdx; i < allOutput.length; i++) {
                if (allOutput[i] === '{') braceCount++;
                if (allOutput[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    endIdx = i;
                    break;
                  }
                }
              }
              if (endIdx > lastBraceIdx) {
                jsonStr = allOutput.substring(lastBraceIdx, endIdx + 1);
              }
            }
          }
          
          // 如果方法1和2都失败，使用正则表达式匹配（匹配最后一个完整的JSON对象）
          if (!jsonStr) {
            const jsonMatches = allOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            if (jsonMatches && jsonMatches.length > 0) {
              jsonStr = jsonMatches[jsonMatches.length - 1];
            }
          }
          
          if (!jsonStr) {
            console.warn('⚠️  Python脚本输出中未找到有效的JSON');
            console.warn('原始输出（前200字符）:', allOutput.substring(0, 200));
            console.warn('原始输出（后500字符）:', allOutput.substring(Math.max(0, allOutput.length - 500)));
            resolve([]);
            return;
          }
          
          // 清理JSON字符串中的ANSI代码和其他控制字符
          let cleanedJson = jsonStr
            .replace(/\x1b\[[0-9;]*m/g, '') // ANSI颜色代码
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // 其他ANSI代码
            .replace(/[\x00-\x1F\x7F]/g, '') // 其他控制字符（但保留换行和制表符用于JSON中的字符串）
            .trim();
          
          // 移除可能包裹JSON的单引号或双引号
          if ((cleanedJson.startsWith("'") && cleanedJson.endsWith("'")) ||
              (cleanedJson.startsWith('"') && cleanedJson.endsWith('"'))) {
            cleanedJson = cleanedJson.slice(1, -1);
          }
          
          // 如果清理后JSON不完整，尝试修复
          if (!cleanedJson.endsWith('}')) {
            cleanedJson += '}';
          }
          
          // 尝试解析JSON
          let result;
          try {
            result = JSON.parse(cleanedJson);
          } catch (parseError) {
            console.error('❌ JSON解析失败:', parseError.message);
            console.error('尝试解析的JSON（前200字符）:', cleanedJson.substring(0, 200));
            throw parseError;
          }
          
          // 检查是否有错误
          if (result.error) {
            console.error('Python脚本返回错误:', result.error);
            resolve([]);
            return;
          }
          
          // 返回结果对象，包含typos和llm_success标记
          // 这样前端可以区分"LLM成功但没检测到错别字"和"LLM调用失败"
          resolve({
            typos: result.typos || [],
            llm_success: result.llm_success !== false, // 默认true，除非明确标记为false
            summary: result.summary || '',
            count: result.count || (result.typos ? result.typos.length : 0)
          });
        } catch (e) {
          console.error('❌ 解析Python结果失败:', e.message);
          console.error('原始stdout长度:', stdout.length);
          console.error('原始stderr长度:', stderr.length);
          
          // 尝试简单的JSON提取
          try {
            const simpleMatch = (stdout + stderr).match(/\{"typos":[\s\S]*\}/);
            if (simpleMatch) {
              const result = JSON.parse(simpleMatch[0]);
              console.log('✅ 使用简单匹配成功解析JSON');
              resolve({
                typos: result.typos || [],
                llm_success: result.llm_success !== false,
                summary: result.summary || '',
                count: result.count || (result.typos ? result.typos.length : 0)
              });
              return;
            }
          } catch (e2) {
            // 忽略
          }
          
          resolve({
            typos: [],
            llm_success: false,
            summary: '解析失败',
            count: 0
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('启动Python进程失败:', error.message);
        resolve([]);
      });

    } catch (error) {
      console.error('调用LLM错别字检测失败:', error);
      resolve([]);
    }
  });
}

/**
 * 格式化错别字摘要
 * @param {Array} typos - 错别字列表
 * @returns {string} 格式化的摘要
 */
export function formatTypoSummary(typos) {
  if (!typos || typos.length === 0) {
    return '未发现错别字';
  }

  const lines = [`发现 ${typos.length} 个错别字：`];
  
  typos.forEach((typo, index) => {
    lines.push(`${index + 1}. "${typo.word}" → "${typo.correct}"`);
    if (typo.context) {
      lines.push(`   上下文: ${typo.context.substring(0, 50)}...`);
    }
  });

  return lines.join('\n');
}

