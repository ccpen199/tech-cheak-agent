/**
 * 修改意见服务
 * 调用Python智能体提供修改建议
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 调用Python智能体提供修改建议
 * @param {string} text - 要分析的文本内容
 * @param {string} templateId - 模板ID（可选）
 * @returns {Promise<Object>} 修改建议结果
 */
export async function suggestModificationsWithLLM(text, templateId = null) {
  return new Promise((resolve, reject) => {
    try {
      const llmDir = path.join(__dirname, '../../../llm');
      const apiScript = path.join(llmDir, 'agents/modification_suggestion_api.py');
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(apiScript)) {
        console.warn('⚠️  修改意见Python脚本不存在');
        resolve({
          summary: '修改意见服务不可用（Python脚本不存在）',
          suggestions: [],
          count: 0
        });
        return;
      }
      
      // 准备输入数据
      const inputData = JSON.stringify({
        text: text,
        template_id: templateId
      });
      
      // 使用标准输入传递数据
      const pythonProcess = spawn('python3', [apiScript], {
        cwd: llmDir,
        env: { ...process.env, PYTHONPATH: llmDir }
      });
      
      pythonProcess.stdin.write(inputData, 'utf8');
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
          if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
            console.error('❌ Python依赖未安装，无法提供修改建议');
          } else {
            console.error('Python脚本执行失败:', stderr.substring(0, 500));
          }
          resolve({
            summary: '修改意见服务暂时不可用',
            suggestions: [],
            count: 0
          });
          return;
        }

        try {
          // 合并stdout和stderr
          let allOutput = stdout + stderr;
          
          // 匹配JSON对象
          const jsonMatch = allOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          
          if (!jsonMatch || jsonMatch.length === 0) {
            console.warn('⚠️  Python脚本输出中未找到有效的JSON');
            resolve({
              summary: '修改建议结果解析失败',
              suggestions: [],
              count: 0
            });
            return;
          }
          
          // 取最后一个JSON对象
          const jsonStr = jsonMatch[jsonMatch.length - 1];
          const cleanedJson = jsonStr.replace(/\x1b\[[0-9;]*m/g, '');
          const result = JSON.parse(cleanedJson);
          
          // 检查是否有错误
          if (result.error) {
            console.error('Python脚本返回错误:', result.error);
            resolve({
              summary: `建议生成失败：${result.error}`,
              suggestions: [],
              count: 0
            });
            return;
          }
          
          // 返回修改建议结果
          resolve({
            summary: result.summary || '建议生成完成',
            suggestions: result.suggestions || [],
            count: result.count || (result.suggestions ? result.suggestions.length : 0)
          });
        } catch (e) {
          console.error('❌ 解析修改建议结果失败:', e.message);
          resolve({
            summary: '建议结果解析失败',
            suggestions: [],
            count: 0
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('启动Python进程失败:', error.message);
        resolve({
          summary: '修改意见服务启动失败',
          suggestions: [],
          count: 0
        });
      });

    } catch (error) {
      console.error('调用修改意见服务失败:', error);
      resolve({
        summary: '修改意见服务调用失败',
        suggestions: [],
        count: 0
      });
    }
  });
}

