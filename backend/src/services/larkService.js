import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 飞书服务
 * 用于登记文档、存储评审意见等
 */
class LarkService {
  constructor() {
    this.appId = process.env.LARK_APP_ID || '';
    this.appSecret = process.env.LARK_APP_SECRET || '';
    this.accessToken = null;
    this.baseURL = 'https://open.feishu.cn/open-apis';
    this.bitableAppToken = process.env.LARK_BITABLE_APP_TOKEN || '';
    this.bitableTableId = process.env.LARK_BITABLE_TABLE_ID || '';
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/auth/v3/tenant_access_token/internal`,
        {
          app_id: this.appId,
          app_secret: this.appSecret
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        return this.accessToken;
      } else {
        throw new Error(`获取飞书token失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取飞书token错误:', error);
      // 如果配置了飞书，这里会失败；如果没有配置，返回模拟token
      if (!this.appId || !this.appSecret) {
        console.log('未配置飞书凭证，使用模拟模式');
        this.accessToken = 'mock_token';
        return this.accessToken;
      }
      throw error;
    }
  }

  /**
   * 登记文档到飞书多维表格
   */
  async registerDocument(documentData) {
    try {
      const token = await this.getAccessToken();
      
      // 如果使用模拟模式，返回模拟数据
      if (token === 'mock_token' || !this.bitableAppToken || !this.bitableTableId) {
        console.log('使用模拟模式，跳过飞书登记');
        return {
          recordId: `mock_record_${Date.now()}`,
          appToken: 'mock_app_token',
          tableId: 'mock_table_id',
          message: '模拟模式：文档信息已记录（请配置飞书凭证以使用真实功能）'
        };
      }

      // 上传处理后的文档到飞书云文档
      let fileToken = null;
      if (documentData.processedDocPath && fs.existsSync(documentData.processedDocPath)) {
        fileToken = await this.uploadFile(documentData.processedDocPath, token);
      }

      // 格式化错别字信息（优先使用LLM检测结果）
      const typoInfo = documentData.llmTypoSummary || 
        (documentData.typoCount > 0 
          ? `发现 ${documentData.typoCount} 个错别字` 
          : '未发现错别字');
      
      // 格式化修改意见（包含错别字和格式问题）
      const modificationComments = documentData.reviewComments || '无修改意见';

      // 获取当前时间戳（毫秒）
      // 飞书多维表格的时间字段需要毫秒级时间戳
      const currentTimestamp = Date.now();

      // 确保中文数据正确编码
      let docName = documentData.docName || documentData.originalName;
      const docNumber = documentData.docNumber || '-';
      
      // 确保中文正确编码（如果文件名包含乱码字符，尝试修复）
      try {
        // 检查是否包含乱码特征（如 å¥ 这样的字符）
        if (/[åäöÅÄÖ]/.test(docName) && !/[\u4e00-\u9fa5]/.test(docName)) {
          // 可能是latin1编码的中文，尝试转换
          try {
            const fixed = Buffer.from(docName, 'latin1').toString('utf8');
            if (/[\u4e00-\u9fa5]/.test(fixed)) {
              docName = fixed;
              console.log('已修复文件名编码:', docName);
            }
          } catch (e) {
            // 转换失败，使用原文件名
          }
        }
      } catch (e) {
        console.warn('中文编码处理警告:', e.message);
      }
      
      // 调试：打印要发送的数据，确保中文正确
      console.log('准备写入飞书的数据:');
      console.log('  教案名称:', docName);
      console.log('  教案编号:', docNumber);
      console.log('  入库时间戳:', currentTimestamp);

      // 构建字段数据（只包含非空字段，避免类型转换错误）
      const fields = {
        '教案名称': docName || '',
        '教案编号': docNumber || '-',
        '教案评价': modificationComments || '',
        '修改意见': modificationComments || '',
        '错别字': typoInfo || '',
        '状态': '待审核'
      };
      
      // 只有当时间戳有效时才添加
      if (currentTimestamp && currentTimestamp > 0) {
        fields['入库时间'] = currentTimestamp;
      }

      // 写入多维表格（字段名称需与飞书表格中的字段名称完全一致）
      const record = await this.createBitableRecord({
        fields: fields
      }, token);

      return {
        recordId: record.record.record_id,
        appToken: this.bitableAppToken,
        tableId: this.bitableTableId,
        fileToken: fileToken,
        message: '文档已成功登记到飞书'
      };
    } catch (error) {
      console.error('登记文档到飞书错误:', error);
      // 即使失败也返回基本信息，避免阻塞流程
      return {
        recordId: null,
        error: error.message,
        message: '文档处理完成，但飞书登记失败（请检查配置）'
      };
    }
  }

  /**
   * 上传文件到飞书云文档
   */
  async uploadFile(filePath, token) {
    try {
      const fileStream = fs.createReadStream(filePath);
      const form = new FormData();
      form.append('file', fileStream);
      form.append('file_type', 'docx');
      form.append('file_name', path.basename(filePath));

      const response = await axios.post(
        `${this.baseURL}/drive/v1/files/upload_all`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...form.getHeaders()
          }
        }
      );

      if (response.data.code === 0) {
        return response.data.data.file_token;
      } else {
        throw new Error(`上传文件失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('上传文件到飞书错误:', error);
      return null;
    }
  }

  /**
   * 创建多维表格记录
   */
  async createBitableRecord(recordData, token) {
    try {
      // 确保数据正确编码为UTF-8
      // axios默认会使用JSON.stringify并正确处理UTF-8编码
      const response = await axios.post(
        `${this.baseURL}/bitable/v1/apps/${this.bitableAppToken}/tables/${this.bitableTableId}/records`,
        recordData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );

      if (response.data.code === 0) {
        return response.data.data;
      } else {
        // 输出详细的错误信息
        console.error('飞书API错误响应:', JSON.stringify(response.data, null, 2));
        throw new Error(`创建记录失败: ${response.data.msg || '未知错误'}`);
      }
    } catch (error) {
      console.error('创建飞书表格记录错误:', error);
      if (error.response) {
        console.error('错误响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * 更新多维表格记录
   */
  async updateBitableRecord(recordId, fields, token) {
    try {
      const response = await axios.put(
        `${this.baseURL}/bitable/v1/apps/${this.bitableAppToken}/tables/${this.bitableTableId}/records/${recordId}`,
        {
          fields: fields
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );

      if (response.data.code === 0) {
        return response.data.data;
      } else {
        console.error('飞书API错误响应:', JSON.stringify(response.data, null, 2));
        throw new Error(`更新记录失败: ${response.data.msg || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新飞书表格记录错误:', error);
      if (error.response) {
        console.error('错误响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * 同步教学评价和修改意见到飞书
   */
  async syncReview(recordId, teachingEvaluation, modificationComments) {
    try {
      const token = await this.getAccessToken();
      
      // 如果使用模拟模式，返回模拟数据
      if (token === 'mock_token' || !this.bitableAppToken || !this.bitableTableId) {
        console.log('使用模拟模式，跳过飞书同步');
        return {
          success: true,
          message: '模拟模式：评价和意见已记录（请配置飞书凭证以使用真实功能）'
        };
      }

      if (!recordId) {
        throw new Error('缺少记录ID');
      }

      // 构建要更新的字段
      const fields = {};
      if (teachingEvaluation !== undefined && teachingEvaluation !== null) {
        fields['教案评价'] = teachingEvaluation || '';
      }
      if (modificationComments !== undefined && modificationComments !== null) {
        fields['修改意见'] = modificationComments || '';
      }

      if (Object.keys(fields).length === 0) {
        throw new Error('没有要更新的字段');
      }

      // 更新记录
      await this.updateBitableRecord(recordId, fields, token);

      return {
        success: true,
        message: '教学评价和修改意见已成功同步到飞书'
      };
    } catch (error) {
      console.error('同步评价到飞书错误:', error);
      return {
        success: false,
        error: error.message || '同步失败'
      };
    }
  }
}

// 导出单例
export const larkService = new LarkService();
