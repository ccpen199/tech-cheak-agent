/**
 * 教学评价服务
 * 调用Python智能体进行教学评价
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 调用Python智能体进行教学评价
 * @param {string} text - 要评价的文本内容
 * @param {string} templateId - 模板ID（可选）
 * @returns {Promise<Object>} 评价结果
 */
export async function evaluateTeachingWithLLM(text, templateId = null) {
  return new Promise((resolve, reject) => {
    try {
      const llmDir = path.join(__dirname, '../../../llm');
      const apiScript = path.join(llmDir, 'agents/teaching_evaluation_api.py');
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(apiScript)) {
        console.warn('⚠️  教学评价Python脚本不存在');
        resolve({
          evaluation: '教学评价服务不可用（Python脚本不存在）',
          strengths: [],
          improvements: [],
          overall_score: 0
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
            console.error('❌ Python依赖未安装，无法进行教学评价');
          } else {
            console.error('Python脚本执行失败:', stderr.substring(0, 500));
          }
          resolve({
            evaluation: '教学评价服务暂时不可用',
            strengths: [],
            improvements: [],
            overall_score: 0
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
              evaluation: '教学评价结果解析失败',
              strengths: [],
              improvements: [],
              overall_score: 0
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
              evaluation: `评价失败：${result.error}`,
              strengths: [],
              improvements: [],
              overall_score: 0
            });
            return;
          }
          
          // 返回评价结果
          resolve({
            evaluation: result.evaluation || '评价完成',
            strengths: result.strengths || [],
            improvements: result.improvements || [],
            overall_score: result.overall_score || 0
          });
        } catch (e) {
          console.error('❌ 解析教学评价结果失败:', e.message);
          resolve({
            evaluation: '评价结果解析失败',
            strengths: [],
            improvements: [],
            overall_score: 0
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('启动Python进程失败:', error.message);
        resolve({
          evaluation: '教学评价服务启动失败',
          strengths: [],
          improvements: [],
          overall_score: 0
        });
      });

    } catch (error) {
      console.error('调用教学评价服务失败:', error);
      resolve({
        evaluation: '教学评价服务调用失败',
        strengths: [],
        improvements: [],
        overall_score: 0
      });
    }
  });
}

