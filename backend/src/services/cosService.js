import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import appConfig from '../config/appConfig.js';

/**
 * 上传文件到腾讯云COS
 * @param {string} filePath - 本地文件路径
 * @param {string} objectKey - COS对象键（可选，如果不提供则使用文件名）
 * @returns {Promise<Object>} 上传结果，包含download_url等
 */
export async function uploadToCOS(filePath, objectKey = null) {
  return new Promise((resolve, reject) => {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        resolve({
          success: false,
          error: `文件不存在: ${filePath}`
        });
        return;
      }

      // 使用统一配置获取Python脚本路径
      const scriptPath = appConfig.scripts.cosUploader;
      
      // 检查Python脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        resolve({
          success: false,
          error: `COS上传脚本不存在: ${scriptPath}`
        });
        return;
      }

      // 准备输入数据
      const inputData = JSON.stringify({
        file_path: filePath,
        object_key: objectKey || path.basename(filePath)
      });

      // 使用统一配置获取Python命令
      const pythonCommand = appConfig.python.command;
      
      console.log(`🐍 使用Python: ${pythonCommand}`);
      console.log(`📜 执行脚本: ${scriptPath}`);
      
      const pythonProcess = spawn(pythonCommand, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: appConfig.python.llmDir
        }
      });

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
          console.error('COS上传脚本执行失败:', stderr);
          resolve({
            success: false,
            error: `上传失败: ${stderr || '未知错误'}`
          });
          return;
        }

        try {
          // 解析Python返回的JSON
          const result = JSON.parse(stdout);
          if (result.success) {
            console.log('✅ COS上传成功:', result.download_url);
          } else {
            console.error('❌ COS上传失败:', result.error);
          }
          resolve(result);
        } catch (e) {
          console.error('❌ 解析COS上传结果失败:', e.message);
          console.error('原始输出:', stdout);
          resolve({
            success: false,
            error: `解析结果失败: ${e.message}`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('启动Python进程失败:', error.message);
        resolve({
          success: false,
          error: `启动上传服务失败: ${error.message}`
        });
      });

      // 发送输入数据
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();

    } catch (error) {
      console.error('COS上传服务调用失败:', error);
      resolve({
        success: false,
        error: `服务调用失败: ${error.message}`
      });
    }
  });
}

