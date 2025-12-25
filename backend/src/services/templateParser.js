/**
 * 模板解析器
 * 解析Word文档结构，提取模板架构信息
 */

import mammoth from 'mammoth';

export class TemplateParser {
  /**
   * 解析Word文档结构
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

      // 解析文档结构
      const structure = this.parseStructure(text, html);

      return {
        success: true,
        text: text,
        html: html,
        structure: structure
      };
    } catch (error) {
      console.error('解析文档结构错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析文档结构
   */
  parseStructure(text, html) {
    // 保留所有行，包括空行，以便正确解析环节流程
    const allLines = text.split('\n');
    // 基本信息解析时过滤空行
    const lines = allLines.filter(line => line.trim());
    const structure = {
      sections: [],
      tables: [],
      lists: []
    };

    // 识别基本信息区域（表格形式）
    const basicInfo = this.parseBasicInfo(lines);
    if (basicInfo) {
      structure.sections.push({
        type: 'basic_info',
        title: '基本信息',
        fields: basicInfo
      });
    }

    // 识别环节流程（使用所有行，包括空行）
    const segments = this.parseSegments(allLines);
    if (segments.length > 0) {
      structure.sections.push({
        type: 'segments',
        title: '环节流程',
        items: segments
      });
    }

    return structure;
  }

  /**
   * 解析基本信息区域
   */
  parseBasicInfo(lines) {
    const fields = [];
    const fieldPatterns = [
      { name: '节日', pattern: /节\s*日/ },
      { name: '活动名称', pattern: /活动名称/ },
      { name: '材料', pattern: /材\s*料/ }
    ];

    fieldPatterns.forEach(field => {
      const lineIndex = lines.findIndex(line => field.pattern.test(line));
      if (lineIndex !== -1) {
        const line = lines[lineIndex];
        // 提取字段值（可能是表格形式，用制表符分隔）
        const parts = line.split(/\t/);
        let value = '';
        if (parts.length > 1) {
          value = parts.slice(1).join('\t').trim();
        } else {
          // 尝试从下一行获取值
          if (lineIndex + 1 < lines.length) {
            value = lines[lineIndex + 1].trim();
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
   * 解析环节流程
   */
  parseSegments(lines) {
    const segments = [];
    const segmentPattern = /环节(\d+)[：:]\s*(.+?)(?=\s+\d+\s*分钟|$)/;
    
    // 查找所有环节
    let currentSegment = null;
    
    lines.forEach((line, index) => {
      // 环节标题和时间可能在不同行，需要特殊处理
      // 匹配 "环节1：" 这样的格式（标题和时间可能在不同行）
      const segmentTitleMatch = line.match(/环节(\d+)[：:]/);
      
      if (segmentTitleMatch) {
        // 保存上一个环节
        if (currentSegment) {
          segments.push(currentSegment);
        }
        
        // 根据实际文档结构：环节1： 在下一行是 x分钟，标题可能为空或需要从其他地方提取
        // 先查找时间（通常在环节标题的下一行）
        let time = '';
        for (let i = index + 1; i < Math.min(index + 3, lines.length); i++) {
          const timeLineMatch = lines[i].match(/(\d+|[xX])\s*分钟/);
          if (timeLineMatch) {
            time = timeLineMatch[1];
            break;
          }
        }
        
        // 提取标题（如果环节标题行有内容，且不是时间）
        let title = '';
        const titleMatch = line.match(/环节\d+[：:]\s*(.+)/);
        if (titleMatch && titleMatch[1].trim() && !titleMatch[1].match(/\d+\s*分钟|[xX]\s*分钟/)) {
          title = titleMatch[1].trim();
        }
        // 如果标题为空，保持为空（因为模板中环节标题可能确实为空）
        
        // 开始新环节
        currentSegment = {
          number: segmentTitleMatch[1],
          title: title || '',
          time: time,
          line: index + 1,
          method: {
            title: '操作方法',
            items: [],
            found: false,
            editable: true
          },
          division: {
            title: '主/助教分工',
            value: '',
            found: false,
            editable: true
          },
          guidance: {
            title: '教师指导语',
            items: [],
            found: false,
            editable: true
          }
        };
      } else if (currentSegment) {
        // 解析环节内容
        this.parseSegmentContent(line, currentSegment);
      }
    });
    
    // 添加最后一个环节
    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * 解析环节内容
   */
  parseSegmentContent(line, segment) {
    const trimmed = line.trim();
    
    // 跳过空行和时间行（包括 x分钟 这样的占位符）
    if (!trimmed || /^([xX]|\d+)\s*分钟$/.test(trimmed)) {
      return;
    }
    
    // 检查操作方法（支持多种格式）
    if (/操作方法[：:]/.test(trimmed)) {
      segment.method.found = true;
      segment.division.found = false;
      segment.guidance.found = false;
      return;
    }
    
    // 检查主/助教分工
    if (/主\/助教分工[：:]/.test(trimmed)) {
      segment.division.found = true;
      segment.method.found = false;
      segment.guidance.found = false;
      return;
    }
    
    // 检查教师指导语
    if (/教师指导语[：:]/.test(trimmed)) {
      segment.guidance.found = true;
      segment.method.found = false;
      segment.division.found = false;
      return;
    }
    
    // 如果是序号列表项（支持多种格式：1. 1。 1、）
    const numberedMatch = trimmed.match(/^(\d+)[\.。、]\s*(.+)/);
    if (numberedMatch) {
      const item = {
        number: numberedMatch[1],
        content: numberedMatch[2].trim(),
        editable: true
      };
      
      // 判断属于哪个部分
      if (segment.method.found && !segment.division.found && !segment.guidance.found) {
        segment.method.items.push(item);
      } else if (segment.guidance.found) {
        segment.guidance.items.push(item);
      }
      return;
    }
    
    // 如果是主/助教分工的内容（非序号，非标题）
    if (segment.division.found && !segment.guidance.found && trimmed && 
        !/操作方法|主\/助教分工|教师指导语|环节\d+/.test(trimmed)) {
      if (!segment.division.value) {
        segment.division.value = trimmed;
      } else {
        segment.division.value += '\n' + trimmed;
      }
      return;
    }
    
    // 如果没有序号但内容不为空，且当前在操作方法部分，也作为操作方法项添加
    if (segment.method.found && !segment.division.found && !segment.guidance.found && trimmed) {
      // 检查是否是纯文本内容（不是标题）
      if (!/操作方法|主\/助教分工|教师指导语|环节\d+/.test(trimmed)) {
        // 如果没有序号，自动添加序号
        const nextNumber = segment.method.items.length + 1;
        segment.method.items.push({
          number: String(nextNumber),
          content: trimmed,
          editable: true
        });
        return;
      }
    }
    
    // 如果没有序号但内容不为空，且当前在教师指导语部分，也作为指导语项添加
    if (segment.guidance.found && trimmed) {
      if (!/操作方法|主\/助教分工|教师指导语|环节\d+/.test(trimmed)) {
        const nextNumber = segment.guidance.items.length + 1;
        segment.guidance.items.push({
          number: String(nextNumber),
          content: trimmed,
          editable: true
        });
        return;
      }
    }
  }
}

export const templateParser = new TemplateParser();

