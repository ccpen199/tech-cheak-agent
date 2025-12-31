/**
 * 修改意见服务
 * 调用Python智能体提供修改建议
 */

import { spawn } from 'child_process';
import fs from 'fs';
import appConfig from '../config/appConfig.js';

/**
 * 调用Python智能体提供修改建议
 * @param {string} text - 要分析的文本内容
 * @param {string} templateId - 模板ID（可选）
 * @param {string} customPrompt - 自定义提示词（可选，如果提供则替代默认提示词）
 * @returns {Promise<Object>} 修改建议结果
 */
export async function suggestModificationsWithLLM(text, templateId = null, customPrompt = null) {
  return new Promise((resolve, reject) => {
    try {
      const apiScript = appConfig.scripts.modificationSuggestion;
      const llmDir = appConfig.python.llmDir;
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(apiScript)) {
        console.warn(`⚠️  修改意见Python脚本不存在: ${apiScript}`);
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
          // 合并stdout和stderr（与教学评价服务保持一致）
          let allOutput = stdout + stderr;
          
          // 记录原始输出长度用于调试
          console.log('原始stdout长度:', stdout.length);
          console.log('原始stderr长度:', stderr.length);
          console.log('原始stdout内容（前500字符）:', stdout.substring(0, 500));
          
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
              console.log('✅ 从stdout第一个{提取JSON，长度:', jsonStr.length);
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
                console.log('✅ 从合并输出第一个{提取JSON，长度:', jsonStr.length);
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
                console.log('✅ 从最后一个{提取JSON，长度:', jsonStr.length);
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
            console.warn('⚠️  返回解析失败的结果');
            const failedResult = {
              summary: '修改建议结果解析失败',
              suggestions: [],
              count: 0
            };
            resolve(failedResult);
            return;
          }
          
          console.log('✅ JSON字符串提取成功，长度:', jsonStr.length);
          console.log('  前200字符:', jsonStr.substring(0, 200));
          console.log('  后200字符:', jsonStr.substring(Math.max(0, jsonStr.length - 200)));
          
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
            console.log('🔄 尝试解析JSON，清理后的JSON长度:', cleanedJson.length);
            result = JSON.parse(cleanedJson);
            console.log('✅ JSON解析成功');
          } catch (parseError) {
            console.error('❌ JSON解析失败:', parseError.message);
            console.error('尝试解析的JSON（前200字符）:', cleanedJson.substring(0, 200));
            console.error('尝试解析的JSON（后200字符）:', cleanedJson.substring(Math.max(0, cleanedJson.length - 200)));
            throw parseError;
          }
          
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
          console.log('✅ 修改建议解析成功:');
          console.log('  - summary:', result.summary || '无');
          console.log('  - suggestions数量:', result.suggestions?.length || 0);
          console.log('  - 完整result对象keys:', Object.keys(result));
          
          // 检查结果结构
          if (!result.summary && !result.suggestions) {
            console.warn('⚠️  解析后的result没有summary和suggestions字段，原始result:', JSON.stringify(result).substring(0, 300));
          }
          
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

