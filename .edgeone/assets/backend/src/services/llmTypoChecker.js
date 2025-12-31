/**
 * 基于LLM的错别字检测服务
 * 调用Python智能体进行错别字检测
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 调用Python智能体检测错别字
 * @param {string} text - 要检测的文本内容
 * @returns {Promise<Array>} 错别字结果数组
 */
export async function checkTyposWithLLM(text) {
  return new Promise((resolve, reject) => {
    try {
      // Python脚本路径
      const pythonScript = path.join(
        __dirname,
        '../../../llm/agents/typo_agent.py'
      );

      // 调用Python脚本（使用API接口方式）
      const llmDir = path.join(__dirname, '../../../llm');
      const apiScript = path.join(llmDir, 'agents/typo_check_api.py');
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(apiScript)) {
        console.warn('⚠️  Python智能体脚本不存在，使用传统方法');
        resolve([]);
        return;
      }
      
      // 检查Python是否可用
      const pythonCheck = spawn('python3', ['--version']);
      pythonCheck.on('error', () => {
        console.warn('⚠️  Python3 未安装，无法使用LLM智能体，使用传统方法');
        resolve([]);
      });
      pythonCheck.on('close', (code) => {
        if (code !== 0) {
          console.warn('⚠️  Python3 检查失败，使用传统方法');
          resolve([]);
        }
      });
      
      // 使用标准输入传递文本
      const pythonProcess = spawn('python3', [apiScript], {
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
          let allOutput = stdout + stderr;
          
          // 使用正则表达式直接匹配JSON对象（更可靠）
          const jsonMatch = allOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          
          if (!jsonMatch || jsonMatch.length === 0) {
            console.warn('⚠️  Python脚本输出中未找到有效的JSON');
            console.warn('原始输出（最后300字符）:', allOutput.substring(Math.max(0, allOutput.length - 300)));
            resolve([]);
            return;
          }
          
          // 取最后一个JSON对象（通常是最新的结果）
          const jsonStr = jsonMatch[jsonMatch.length - 1];
          
          // 清理JSON字符串中的ANSI代码
          const cleanedJson = jsonStr.replace(/\x1b\[[0-9;]*m/g, '');
          
          const result = JSON.parse(cleanedJson);
          
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

