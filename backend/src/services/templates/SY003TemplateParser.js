/**
 * SY003-童萌-主题活动通用模板解析器
 * 结构：课程名称、物资准备、注意事项、环节流程（只有操作方法和教师指导语，没有主/助教分工）
 */

import { BaseTemplateParser } from './BaseTemplateParser.js';

export class SY003TemplateParser extends BaseTemplateParser {
  constructor() {
    super('SY003', '童萌-主题活动通用模板');
  }

  /**
   * 识别模板
   */
  static identify(text) {
    return /课程名称|物资准备|注意事项|环节流程/.test(text) && 
           !/节\s*日|活动名称/.test(text); // 区别于SY001
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

    // 识别基本信息
    const basicInfo = this.parseBasicInfo(lines, [
      { name: '课程名称', pattern: /课程名称/ },
      { name: '物资准备', pattern: /物资准备/ },
      { name: '注意事项', pattern: /注意事项/ }
    ]);
    
    if (basicInfo) {
      structure.sections.push({
        type: 'basic_info',
        title: '基本信息',
        fields: basicInfo
      });
    }

    // 识别环节流程（类似SY001，但没有主/助教分工）
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
   * 解析环节流程（类似SY001，但没有主/助教分工）
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
        
        currentSegment = {
          number: segmentTitleMatch[1],
          title: '',
          time: time,
          line: index + 1,
          method: {
            title: '操作方法',
            items: [],
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
   * 解析环节内容（没有主/助教分工）
   */
  parseSegmentContent(line, segment) {
    const trimmed = line.trim();
    
    if (!trimmed || /^([xX]|\d+)\s*分钟$/.test(trimmed)) {
      return;
    }
    
    if (/操作方法[：:]/.test(trimmed)) {
      segment.method.found = true;
      segment.guidance.found = false;
      return;
    }
    
    if (/教师指导语[：:]/.test(trimmed)) {
      segment.guidance.found = true;
      segment.method.found = false;
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
      
      if (segment.method.found && !segment.guidance.found) {
        segment.method.items.push(item);
      } else if (segment.guidance.found) {
        segment.guidance.items.push(item);
      }
      return;
    }
    
    if (segment.method.found && !segment.guidance.found && trimmed) {
      if (!/操作方法|教师指导语|环节\d+/.test(trimmed)) {
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
      if (!/操作方法|教师指导语|环节\d+/.test(trimmed)) {
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

