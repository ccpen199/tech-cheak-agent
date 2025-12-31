/**
 * 教学评价服务
 * 调用Python智能体进行教学评价
 */

import { spawn } from 'child_process';
import fs from 'fs';
import appConfig from '../config/appConfig.js';

/**
 * 调用Python智能体进行教学评价
 * @param {string} text - 要评价的文本内容
 * @param {string} templateId - 模板ID（可选）
 * @param {string} customPrompt - 自定义提示词（可选，如果提供则替代默认提示词）
 * @returns {Promise<Object>} 评价结果
 */
export async function evaluateTeachingWithLLM(text, templateId = null, customPrompt = null) {
  return new Promise((resolve, reject) => {
    try {
      const apiScript = appConfig.scripts.teachingEvaluation;
      const llmDir = appConfig.python.llmDir;
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(apiScript)) {
        console.warn(`⚠️  教学评价Python脚本不存在: ${apiScript}`);
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
        template_id: templateId,
        custom_prompt: customPrompt || null
      });
      
      // 使用统一配置的Python命令
      const pythonCommand = appConfig.python.command;
      const pythonProcess = spawn(pythonCommand, [apiScript], {
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
          
          // 记录原始输出长度用于调试
          console.log('原始stdout长度:', stdout.length);
          console.log('原始stderr长度:', stderr.length);
          
          // 改进的JSON提取：先尝试提取完整的JSON对象（支持嵌套）
          let jsonStr = null;
          
          // 方法1：从最后一个{开始提取（因为可能有多个JSON对象或调试输出）
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
          
          // 如果方法1失败，尝试从第一个{开始提取
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
          
          // 如果方法1和2都失败，使用正则表达式匹配（匹配最后一个完整的JSON对象）
          if (!jsonStr) {
            // 匹配所有可能的JSON对象
            const jsonMatches = allOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            if (jsonMatches && jsonMatches.length > 0) {
              // 使用最后一个匹配（通常是最新的结果）
              jsonStr = jsonMatches[jsonMatches.length - 1];
            }
          }
          
          if (!jsonStr) {
            console.warn('⚠️  Python脚本输出中未找到有效的JSON');
            console.warn('原始输出（前200字符）:', allOutput.substring(0, 200));
            console.warn('原始输出（后500字符）:', allOutput.substring(Math.max(0, allOutput.length - 500)));
            resolve({
              evaluation: '教学评价结果解析失败',
              strengths: [],
              improvements: [],
              overall_score: 0
            });
            return;
          }
          
          // 清理JSON字符串中的ANSI代码和其他控制字符
          let cleanedJson = jsonStr
            .replace(/\x1b\[[0-9;]*m/g, '') // ANSI颜色代码
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // 其他ANSI代码
            .replace(/[\x00-\x1F\x7F]/g, '') // 其他控制字符（但保留换行符和制表符用于JSON格式）
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

