/**
 * SY001 模板格式验证器
 * 专门验证"童萌-节庆活动方案模板"的格式
 */

import { SY001_SPEC, isSY001Template } from '../config/template-specs-sy001.js';

export class SY001FormatChecker {
  /**
   * 验证SY001模板格式
   * @param {string} text - 文档文本
   * @param {string} filename - 文件名
   * @returns {Object} 验证结果
   */
  checkFormat(text, filename) {
    // 检查是否为SY001模板
    if (!isSY001Template(text, filename)) {
      return {
        isSY001: false,
        templateId: null,
        templateName: null
      };
    }

    const issues = [];
    const warnings = [];
    const lines = text.split('\n');

    // 1. 检查基本信息区域
    this.checkBasicInfo(text, lines, issues, warnings);

    // 2. 检查环节流程
    this.checkSegments(text, lines, issues, warnings);

    // 3. 检查验证规则
    this.checkValidationRules(text, issues);

    return {
      isSY001: true,
      templateId: SY001_SPEC.id,
      templateName: SY001_SPEC.name,
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues: issues,
      warnings: warnings,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: warnings.length
    };
  }

  /**
   * 检查基本信息区域
   */
  checkBasicInfo(text, lines, issues, warnings) {
    SY001_SPEC.basicInfo.fields.forEach(field => {
      const found = field.pattern.test(text);
      
      if (!found && field.required) {
        issues.push({
          type: 'basic_info',
          field: field.name,
          description: field.message || `缺少"${field.name}"字段`,
          severity: 'error'
        });
      } else if (found) {
        // 检查是否有实际内容（不是只有占位符）
        const lineIndex = this.findLineNumber(lines, field.pattern);
        if (lineIndex !== null) {
          const hasContent = this.hasRealContent(lines, lineIndex, 2);
          if (!hasContent) {
            warnings.push({
              type: 'basic_info',
              field: field.name,
              description: `"${field.name}"字段未填写内容（只有占位符）`,
              severity: 'warning',
              line: lineIndex + 1
            });
          }
        }
      }
    });
  }

  /**
   * 检查环节流程
   */
  checkSegments(text, lines, issues, warnings) {
    // 提取所有环节
    const segmentMatches = text.matchAll(/环节(\d+)[：:]\s*(.+?)(?=环节\d+[：:]|$)/gs);
    const segments = Array.from(segmentMatches);

    if (segments.length === 0) {
      issues.push({
        type: 'segment',
        description: '缺少环节流程，至少应包含1个环节',
        severity: 'error'
      });
      return;
    }

    segments.forEach((match, index) => {
      const segmentNum = match[1];
      const segmentContent = match[2];
      const segmentLine = this.findSegmentLine(lines, segmentNum);

      // 检查环节标题格式
      this.checkSegmentTitle(match[0], segmentLine, issues);

      // 检查时间标注
      this.checkTime(segmentContent, segmentLine, issues, warnings);

      // 检查操作方法
      this.checkMethod(segmentContent, segmentLine, issues, warnings);

      // 检查主/助教分工
      this.checkDivision(segmentContent, segmentLine, issues, warnings);

      // 检查教师指导语
      this.checkGuidance(segmentContent, segmentLine, issues, warnings);
    });
  }

  /**
   * 检查环节标题格式
   */
  checkSegmentTitle(segmentTitle, lineNum, issues) {
    const rule = SY001_SPEC.segmentRules.title;
    
    if (!rule.pattern.test(segmentTitle)) {
      issues.push({
        type: 'segment_title',
        description: rule.message,
        severity: 'error',
        line: lineNum,
        content: segmentTitle.substring(0, 30)
      });
    }
  }

  /**
   * 检查时间标注
   */
  checkTime(segmentContent, segmentLine, issues, warnings) {
    const rule = SY001_SPEC.segmentRules.time;
    const timeMatch = segmentContent.match(rule.pattern);
    
    if (!timeMatch && rule.required) {
      issues.push({
        type: 'time',
        description: rule.message,
        severity: 'error',
        line: segmentLine
      });
    } else if (timeMatch) {
      // 检查时间格式（是否有空格）
      if (/\d+\s+分钟/.test(timeMatch[0])) {
        warnings.push({
          type: 'time',
          description: '时间标注格式建议：数字和"分钟"之间不应有空格（如：10分钟）',
          severity: 'warning',
          line: segmentLine
        });
      }
    }
  }

  /**
   * 检查操作方法
   */
  checkMethod(segmentContent, segmentLine, issues, warnings) {
    const rule = SY001_SPEC.segmentRules.method;
    
    // 检查是否有操作方法标题（不限制行首）
    if (!rule.titlePattern.test(segmentContent)) {
      issues.push({
        type: 'method',
        description: '缺少"操作方法"字段',
        severity: 'error',
        line: segmentLine
      });
      return;
    }

    // 提取操作方法部分（使用更灵活的正则）
    const methodMatch = segmentContent.match(new RegExp(`[•·]\\s*操作方法[：:]([\\s\\S]*?)(?=[•·]|$)`, 'g'));
    if (!methodMatch) return;

    const methodText = methodMatch[0];
    const methodLines = methodText.split('\n').filter(l => l.trim());

    // 检查序号列表
    let numberingCount = 0;
    let numberingIssues = [];

    methodLines.forEach((line, idx) => {
      if (idx === 0) return; // 跳过标题行
      
      const trimmed = line.trim();
      if (/^\d+[\.。、]/.test(trimmed)) {
        numberingCount++;
        
        // 检查序号格式
        if (!/^\d+\.\s/.test(trimmed)) {
          numberingIssues.push({
            line: segmentLine + idx,
            content: trimmed.substring(0, 30),
            issue: '序号格式应为"数字. 空格"（如：1. ）'
          });
        }
        
        // 检查是否以句号结尾
        if (!/[。.]$/.test(trimmed)) {
          numberingIssues.push({
            line: segmentLine + idx,
            content: trimmed.substring(0, 30),
            issue: '操作方法每项应以句号结尾'
          });
        }
      }
    });

    if (numberingCount < rule.minItems) {
      issues.push({
        type: 'method',
        description: rule.message + `，至少应包含${rule.minItems}项`,
        severity: 'error',
        line: segmentLine
      });
    }

    numberingIssues.forEach(issue => {
      warnings.push({
        type: 'method',
        description: `第${issue.line}行：${issue.issue}`,
        severity: 'warning',
        line: issue.line,
        content: issue.content
      });
    });
  }

  /**
   * 检查主/助教分工
   */
  checkDivision(segmentContent, segmentLine, issues, warnings) {
    const rule = SY001_SPEC.segmentRules.division;
    
    if (!rule.titlePattern.test(segmentContent)) {
      issues.push({
        type: 'division',
        description: rule.message,
        severity: 'error',
        line: segmentLine
      });
      return;
    }

    // 检查是否有实际内容（使用更灵活的正则）
    const divisionMatch = segmentContent.match(new RegExp(`[•·]\\s*主/助教分工[：:]([\\s\\S]*?)(?=[•·]|$)`, 'g'));
    if (divisionMatch) {
      const divisionText = divisionMatch[0];
      const hasContent = this.hasRealContent(divisionText.split('\n'), 0, 3);
      
      if (!hasContent) {
        warnings.push({
          type: 'division',
          description: '"主/助教分工"未填写内容（只有占位符）',
          severity: 'warning',
          line: segmentLine
        });
      }
    }
  }

  /**
   * 检查教师指导语
   */
  checkGuidance(segmentContent, segmentLine, issues, warnings) {
    const rule = SY001_SPEC.segmentRules.guidance;
    
    if (!rule.titlePattern.test(segmentContent)) {
      issues.push({
        type: 'guidance',
        description: '缺少"教师指导语"字段',
        severity: 'error',
        line: segmentLine
      });
      return;
    }

    // 提取教师指导语部分（使用更灵活的正则）
    const guidanceMatch = segmentContent.match(new RegExp(`[•·]\\s*教师指导语[：:]([\\s\\S]*?)(?=[•·]|$)`, 'g'));
    if (!guidanceMatch) return;

    const guidanceText = guidanceMatch[0];
    const guidanceLines = guidanceText.split('\n').filter(l => l.trim());

    // 检查序号列表
    let numberingCount = 0;
    let numberingIssues = [];

    guidanceLines.forEach((line, idx) => {
      if (idx === 0) return; // 跳过标题行
      
      const trimmed = line.trim();
      if (/^\d+[\.。、]/.test(trimmed)) {
        numberingCount++;
        
        // 检查序号格式
        if (!/^\d+\.\s/.test(trimmed)) {
          numberingIssues.push({
            line: segmentLine + idx,
            content: trimmed.substring(0, 30),
            issue: '序号格式应为"数字. 空格"（如：1. ）'
          });
        }
      }
    });

    if (numberingCount < rule.minItems) {
      issues.push({
        type: 'guidance',
        description: rule.message + `，至少应包含${rule.minItems}项`,
        severity: 'error',
        line: segmentLine
      });
    }

    numberingIssues.forEach(issue => {
      warnings.push({
        type: 'guidance',
        description: `第${issue.line}行：${issue.issue}`,
        severity: 'warning',
        line: issue.line,
        content: issue.content
      });
    });
  }

  /**
   * 检查验证规则
   */
  checkValidationRules(text, issues) {
    SY001_SPEC.validationRules.forEach(rule => {
      const isValid = rule.check(text);
      if (!isValid) {
        issues.push({
          type: 'validation',
          rule: rule.name,
          description: rule.message,
          severity: 'error'
        });
      }
    });
  }

  /**
   * 查找模式匹配的行号
   */
  findLineNumber(lines, pattern) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i;
      }
    }
    return null;
  }

  /**
   * 查找环节所在行号
   */
  findSegmentLine(lines, segmentNum) {
    for (let i = 0; i < lines.length; i++) {
      if (new RegExp(`环节${segmentNum}[：:]`).test(lines[i])) {
        return i + 1;
      }
    }
    return null;
  }

  /**
   * 检查是否有实际内容（不是只有占位符）
   */
  hasRealContent(lines, startIndex, checkLines = 3) {
    for (let i = startIndex; i < Math.min(startIndex + checkLines, lines.length); i++) {
      const line = lines[i]?.trim() || '';
      // 如果包含实际的中文内容（不是只有占位符），认为有内容
      if (line && /[\u4e00-\u9fa5]{2,}/.test(line) && !/^[xX]+$/.test(line.replace(/[\u4e00-\u9fa5\s：:，。、\d\.]/g, ''))) {
        return true;
      }
    }
    return false;
  }

  /**
   * 格式化结果用于前端显示
   */
  formatResultsForDisplay(result) {
    if (!result.isSY001) {
      return null;
    }

    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = [
      ...result.issues.filter(i => i.severity === 'warning'),
      ...(result.warnings || [])
    ];

    return {
      templateId: result.templateId,
      templateName: result.templateName,
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(issue => ({
        type: issue.type,
        description: issue.description,
        line: issue.line,
        content: issue.content
      })),
      warnings: warnings.map(issue => ({
        type: issue.type,
        description: issue.description,
        line: issue.line,
        content: issue.content
      }))
    };
  }
}

export const sy001FormatChecker = new SY001FormatChecker();

