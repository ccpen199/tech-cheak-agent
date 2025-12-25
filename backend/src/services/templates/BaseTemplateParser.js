/**
 * 基础模板解析器
 * 提供通用的解析功能，各模板解析器继承此类
 */

import mammoth from 'mammoth';

export class BaseTemplateParser {
  constructor(templateId, templateName) {
    this.templateId = templateId;
    this.templateName = templateName;
  }

  /**
   * 解析Word文档结构（通用入口）
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseDocument(filePath) {
    try {
      // 提取文本
      const textResult = await mammoth.extractRawText({ path: filePath });
      const text = textResult.value;

      // 转换为HTML以获取结构信息
      const htmlResult = await mammoth.convertToHtml({ path: filePath });
      const html = htmlResult.value;

      // 调用子类实现的解析方法
      const structure = this.parseStructure(text, html);

      return {
        success: true,
        text: text,
        html: html,
        structure: {
          ...structure,
          templateId: this.templateId,
          templateName: this.templateName
        }
      };
    } catch (error) {
      console.error(`解析文档结构错误 [${this.templateId}]:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析文档结构（子类必须实现）
   * @param {string} text - 文档文本
   * @param {string} html - 文档HTML
   * @returns {Object} 文档结构
   */
  parseStructure(text, html) {
    throw new Error('parseStructure must be implemented by subclass');
  }

  /**
   * 辅助方法：提取基本信息字段（通用）
   * @param {Array<string>} lines - 文档行数组
   * @param {Array<Object>} fieldPatterns - 字段匹配模式 [{ name, pattern }]
   * @returns {Array<Object>} 字段数组
   */
  parseBasicInfo(lines, fieldPatterns) {
    const fields = [];
    
    // 收集所有字段标签模式，用于判断下一行是否是另一个字段
    const allFieldPatterns = fieldPatterns.map(f => f.pattern);
    
    // 常见的字段名称列表，用于防止将字段名称当作值
    // 即使没有传入这些字段的模式，也要识别它们
    const commonFieldNames = [
      '课程编号', '课程目标', '课程材料', '教学步骤',
      '环节流程', '活动名称', '节日', '绘本', '食育'
    ];
    const commonFieldPatterns = commonFieldNames.map(name => new RegExp('^' + name + '[：:]?'));

      fieldPatterns.forEach(field => {
      const lineIndex = lines.findIndex(line => field.pattern.test(line));
      if (lineIndex !== -1) {
        const line = lines[lineIndex];
        let value = '';
        
        // 1. 先检查是否是冒号分隔格式：课程编号：值
        // 注意：在字符串中，\s需要写成\\s
        const colonMatch = line.match(new RegExp(field.name + '[：:]\\s*(.+)'));
        if (colonMatch) {
          value = colonMatch[1].trim();
        } else {
          // 2. 检查是否是表格形式，用制表符分隔
          const parts = line.split(/\t/);
          if (parts.length > 1) {
            value = parts.slice(1).join('\t').trim();
          } else {
            // 3. 尝试从下一行获取值，但要检查：
            // 3.1 下一行不能是空行
            // 3.2 下一行不能是另一个字段的标签（包括传入的字段和常见字段）
            if (lineIndex + 1 < lines.length) {
              const nextLine = lines[lineIndex + 1].trim();
              // 如果下一行是空行，值应该为空
              if (nextLine === '') {
                value = '';
              } else {
                // 检查下一行是否是另一个字段的标签
                // 检查传入的字段模式
                const isAnotherField = allFieldPatterns.some(pattern => pattern.test(nextLine));
                // 检查常见字段名称（防止将字段名称当作值）
                const isCommonField = commonFieldPatterns.some(pattern => pattern.test(nextLine));
                
                if (!isAnotherField && !isCommonField) {
                  value = nextLine;
                } else {
                  // 下一行是另一个字段，当前字段值为空
                  value = '';
                }
              }
            }
          }
        }
        
        fields.push({
          name: field.name,
          value: value || '',
          line: lineIndex + 1,
          editable: true
        });
      }
    });

    return fields.length > 0 ? fields : null;
  }

  /**
   * 辅助方法：识别模板类型
   * @param {string} text - 文档文本
   * @param {Array<RegExp>} identificationPatterns - 识别模式数组
   * @returns {boolean} 是否匹配
   */
  identifyTemplate(text, identificationPatterns) {
    return identificationPatterns.some(pattern => pattern.test(text));
  }
}

