/**
 * 模板解析器工厂
 * 根据模板ID或文档内容自动选择合适的解析器
 */

import { SY001TemplateParser } from './SY001TemplateParser.js';
import { SY002TemplateParser } from './SY002TemplateParser.js';
import { SY003TemplateParser } from './SY003TemplateParser.js';
import { SY004TemplateParser } from './SY004TemplateParser.js';
import { SY005TemplateParser } from './SY005TemplateParser.js';

import mammoth from 'mammoth';
import path from 'path';

export class TemplateParserFactory {
  /**
   * 获取模板解析器
   * @param {string} templateId - 模板ID (SY001, SY002等)
   * @returns {BaseTemplateParser} 模板解析器实例
   */
  static getParser(templateId) {
    const parsers = {
      'SY001': () => new SY001TemplateParser(),
      'SY002': () => new SY002TemplateParser(),
      'SY003': () => new SY003TemplateParser(),
      'SY004': () => new SY004TemplateParser(),
      'SY005': () => new SY005TemplateParser(),
    };

    const createParser = parsers[templateId];
    if (!createParser) {
      throw new Error(`未找到模板解析器: ${templateId}`);
    }

    return createParser();
  }

  /**
   * 自动识别模板类型
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 模板ID
   */
  static async identifyTemplate(filePath) {
    try {
      const textResult = await mammoth.extractRawText({ path: filePath });
      const text = textResult.value;

      // 按优先级尝试识别（更具体的模板先识别）
      // 注意：SY002应该在SY005之前检查，因为两者可能有重叠的识别条件
      // 优先检查文件名关键字
      const fileName = path.basename(filePath, '.docx');
      console.log('[TemplateParserFactory] 识别模板，文件名:', fileName);
      
      // 优先按文件名识别（最可靠）
      if (/SY001|节庆活动/.test(fileName)) {
        console.log('[TemplateParserFactory] 文件名包含SY001或节庆活动关键字，检查SY001模板...');
        if (SY001TemplateParser.identify(text)) {
          console.log('[TemplateParserFactory] ✅ 识别为SY001模板');
          return 'SY001';
        }
        console.log('[TemplateParserFactory] SY001识别失败');
      }
      if (/SY003|主题活动/.test(fileName)) {
        console.log('[TemplateParserFactory] 文件名包含SY003或主题活动关键字，检查SY003模板...');
        if (SY003TemplateParser.identify(text)) {
          console.log('[TemplateParserFactory] ✅ 识别为SY003模板');
          return 'SY003';
        }
        console.log('[TemplateParserFactory] SY003识别失败');
      }
      if (/SY002|体适能/.test(fileName)) {
        console.log('[TemplateParserFactory] 文件名包含SY002或体适能关键字，检查SY002模板...');
        if (SY002TemplateParser.identify(text)) {
          console.log('[TemplateParserFactory] ✅ 识别为SY002模板');
          return 'SY002';
        }
        console.log('[TemplateParserFactory] SY002识别失败');
      }
      if (/SY005|食育/.test(fileName)) {
        console.log('[TemplateParserFactory] 文件名包含SY005或食育关键字，检查SY005模板...');
        if (SY005TemplateParser.identify(text)) {
          console.log('[TemplateParserFactory] ✅ 识别为SY005模板');
          return 'SY005';
        }
        console.log('[TemplateParserFactory] SY005识别失败');
      }
      if (/SY004|绘本剧/.test(fileName)) {
        console.log('[TemplateParserFactory] 文件名包含SY004或绘本剧关键字，检查SY004模板...');
        if (SY004TemplateParser.identify(text)) {
          console.log('[TemplateParserFactory] ✅ 识别为SY004模板');
          return 'SY004';
        }
        console.log('[TemplateParserFactory] SY004识别失败');
      }
      
      // 如果文件名没有提示，按内容识别（按优先级顺序）
      console.log('[TemplateParserFactory] 按内容识别模板...');
      if (SY004TemplateParser.identify(text)) {
        console.log('[TemplateParserFactory] ✅ 识别为SY004模板（按内容）');
        return 'SY004';
      }
      if (SY003TemplateParser.identify(text)) {
        console.log('[TemplateParserFactory] ✅ 识别为SY003模板（按内容）');
        return 'SY003';
      }
      if (SY002TemplateParser.identify(text)) {
        console.log('[TemplateParserFactory] ✅ 识别为SY002模板（按内容）');
        return 'SY002';
      }
      if (SY005TemplateParser.identify(text)) {
        console.log('[TemplateParserFactory] ✅ 识别为SY005模板（按内容）');
        return 'SY005';
      }
      if (SY001TemplateParser.identify(text)) {
        console.log('[TemplateParserFactory] ✅ 识别为SY001模板（按内容）');
        return 'SY001';
      }

      // 默认返回SY001（向后兼容）
      console.warn('无法识别模板类型，使用默认模板 SY001');
      return 'SY001';
    } catch (error) {
      console.error('识别模板类型错误:', error);
      return 'SY001'; // 默认
    }
  }

  /**
   * 解析文档（自动识别模板）
   * @param {string} filePath - 文件路径
   * @param {string} templateId - 可选的模板ID，如果不提供则自动识别
   * @returns {Promise<Object>} 解析结果
   */
  static async parseDocument(filePath, templateId = null) {
    // 如果没有指定模板ID，自动识别
    if (!templateId) {
      templateId = await this.identifyTemplate(filePath);
      console.log('自动识别模板类型:', templateId);
    } else {
      console.log('使用指定的模板类型:', templateId);
    }

    const parser = this.getParser(templateId);
    const result = await parser.parseDocument(filePath);
    
    // 确保返回结果包含templateId（用于调试）
    if (result.success && result.structure) {
      result.templateId = templateId;
      console.log('模板解析成功:', templateId, 'sections数量:', result.structure.sections?.length || 0);
    } else {
      console.error('模板解析失败:', templateId, result.error);
    }
    
    return result;
  }
}

