/**
 * SY001-童萌-节庆活动方案模板解析器
 */

import { BaseTemplateParser } from './BaseTemplateParser.js';

export class SY001TemplateParser extends BaseTemplateParser {
  constructor() {
    super('SY001', '童萌-节庆活动方案模板');
  }

  /**
   * 识别模板
   */
  static identify(text) {
    return /节\s*日|环节流程|环节\d+/.test(text);
  }

  /**
   * 解析文档结构
   */
  parseStructure(text, html) {
    const allLines = text.split('\n');
    const lines = allLines.filter(line => line.trim());
    const structure = {
      sections: [],
      tables: [],
      lists: []
    };

    // 识别基本信息区域
    const basicInfo = this.parseBasicInfo(lines, [
      { name: '节日', pattern: /节\s*日/ },
      { name: '活动名称', pattern: /活动名称/ },
      { name: '材料', pattern: /材\s*料/ }
    ]);
    
    if (basicInfo) {
      structure.sections.push({
        type: 'basic_info',
        title: '基本信息',
        fields: basicInfo
      });
    }

    // 识别环节流程
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
   * 解析环节流程
   */
  parseSegments(lines) {
    const segments = [];
    let currentSegment = null;
    
    // 查找"示例图片"的位置，在此之后的内容不解析（但保留用于下载）
    let exampleImageIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/示例图片|示例|图片/.test(lines[i])) {
        exampleImageIndex = i;
        break;
      }
    }
    
    lines.forEach((line, index) => {
      // 如果遇到"示例图片"，停止解析
      if (exampleImageIndex !== -1 && index >= exampleImageIndex) {
        return;
      }
      
      const segmentTitleMatch = line.match(/环节(\d+)[：:]/);
      
      if (segmentTitleMatch) {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        
        let time = '';
        for (let i = index + 1; i < Math.min(index + 3, lines.length); i++) {
          const timeLineMatch = lines[i].match(/(\d+|[xX])\s*分钟/);
          if (timeLineMatch) {
            time = timeLineMatch[1];
            break;
          }
        }
        
        let title = '';
        const titleMatch = line.match(/环节\d+[：:]\s*(.+)/);
        if (titleMatch && titleMatch[1].trim() && !titleMatch[1].match(/\d+\s*分钟|[xX]\s*分钟/)) {
          title = titleMatch[1].trim();
        }
        
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
        this.parseSegmentContent(line, currentSegment);
      }
    });
    
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
    
    if (!trimmed || /^([xX]|\d+)\s*分钟$/.test(trimmed)) {
      return;
    }
    
    // 识别操作方法标记（支持多种格式）
    if (/操作方法[：:]/.test(trimmed) || /^操作方法/.test(trimmed)) {
      segment.method.found = true;
      segment.division.found = false;
      segment.guidance.found = false;
      return;
    }
    
    if (/主\/助教分工[：:]/.test(trimmed)) {
      segment.division.found = true;
      segment.method.found = false;
      segment.guidance.found = false;
      return;
    }
    
    if (/教师指导语[：:]/.test(trimmed)) {
      segment.guidance.found = true;
      segment.method.found = false;
      segment.division.found = false;
      return;
    }
    
    // 匹配序号格式：1. 内容 或 1。内容 或 1、内容
    // 注意：序号后面可能没有内容（如 "5."），这种情况下跳过
    const numberedMatch = trimmed.match(/^(\d+)[\.。、]\s*(.*)/);
    if (numberedMatch) {
      const number = numberedMatch[1];
      const content = numberedMatch[2] ? numberedMatch[2].trim() : '';
      
      // 如果只有序号没有内容，跳过（可能是格式问题）
      if (!content) {
        return;
      }
      
      const item = {
        number: number,
        content: content,
        editable: true
      };
      
      if (segment.method.found && !segment.division.found && !segment.guidance.found) {
        segment.method.items.push(item);
      } else if (segment.guidance.found) {
        segment.guidance.items.push(item);
      }
      return;
    }
    
    if (segment.division.found && !segment.guidance.found && trimmed && 
        !/操作方法|主\/助教分工|教师指导语|环节\d+/.test(trimmed)) {
      if (!segment.division.value) {
        segment.division.value = trimmed;
      } else {
        segment.division.value += '\n' + trimmed;
      }
      return;
    }
    
    if (segment.method.found && !segment.division.found && !segment.guidance.found && trimmed) {
      if (!/操作方法|主\/助教分工|教师指导语|环节\d+/.test(trimmed)) {
        const nextNumber = segment.method.items.length + 1;
        segment.method.items.push({
          number: String(nextNumber),
          content: trimmed,
          editable: true
        });
        return;
      }
    }
    
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

