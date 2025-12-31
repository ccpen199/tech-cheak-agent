/**
 * SY004-童萌-绘本剧模板解析器
 * 结构：绘本名称、课时、教学目标、教学准备、绘本简介、教学过程（导入环节、精读环节、拓展环节）
 */

import { BaseTemplateParser } from './BaseTemplateParser.js';

export class SY004TemplateParser extends BaseTemplateParser {
  constructor() {
    super('SY004', '童萌-绘本剧模板');
  }

  /**
   * 识别模板
   */
  static identify(text) {
    return /绘本名称|课时|教学目标|教学准备|绘本简介|导入环节|精读环节|拓展环节/.test(text);
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

    // 识别基本信息（课程编号、作者、绘本名称、课时是单行字段）
    const basicInfo = this.parseBasicInfo(lines, [
      { name: '课程编号', pattern: /课程编号/ },
      { name: '作者', pattern: /作\s*者/ },
      { name: '绘本名称', pattern: /绘本名称/ },
      { name: '课时', pattern: /课时/ },
      { name: '教学目标', pattern: /教学目标/ },
      { name: '教学准备', pattern: /教学准备/ },
      { name: '绘本简介', pattern: /绘本简介/ },
      { name: '教学过程', pattern: /教学过程/ }
    ]);
    
    console.log('[SY004Parser] 解析到的基本信息字段:', basicInfo ? basicInfo.map(f => f.name).join(', ') : '无');
    
    // 识别教学目标（带编号列表）
    const teachingObjectives = this.parseNumberedList('教学目标', allLines);
    
    // 识别教学准备（带编号列表）
    const teachingPreparation = this.parseNumberedList('教学准备', allLines);
    
    // 识别绘本简介（文本区域）
    const bookIntroduction = this.parseTextArea('绘本简介', allLines);
    
    // 注意：模版4 绘本简介后面没有"阅读测评"，只有"教学过程"
    // 如果后续需要支持"阅读测评"，可以在这里添加解析
    
    // 合并所有基本信息，确保顺序：课程编号、作者、绘本名称、课时、教学目标、教学准备、绘本简介
    const allBasicInfo = [];
    if (basicInfo) {
      // 确保字段顺序正确：课程编号、作者在最前面
      const courseNumberField = basicInfo.find(f => f.name === '课程编号');
      const authorField = basicInfo.find(f => f.name === '作者');
      const bookNameField = basicInfo.find(f => f.name === '绘本名称');
      const classHourField = basicInfo.find(f => f.name === '课时');
      
      if (courseNumberField) {
        allBasicInfo.push(courseNumberField);
        console.log('[SY004Parser] 添加字段: 课程编号 = "' + (courseNumberField.value || '(空)') + '"');
      }
      if (authorField) {
        allBasicInfo.push(authorField);
        console.log('[SY004Parser] 添加字段: 作者 = "' + (authorField.value || '(空)') + '"');
      }
      if (bookNameField) {
        allBasicInfo.push(bookNameField);
      }
      if (classHourField) {
        allBasicInfo.push(classHourField);
      }
    }
    if (teachingObjectives) {
      allBasicInfo.push(teachingObjectives);
    }
    if (teachingPreparation) {
      allBasicInfo.push(teachingPreparation);
    }
    if (bookIntroduction) {
      allBasicInfo.push(bookIntroduction);
    }
    
    console.log('[SY004Parser] 最终基本信息字段数:', allBasicInfo.length);
    
    if (allBasicInfo.length > 0) {
      structure.sections.push({
        type: 'basic_info',
        title: '基本信息',
        fields: allBasicInfo
      });
    }

    // 识别教学过程（导入、精读、拓展）
    const process = this.parseProcess(allLines);
    if (process) {
      structure.sections.push(process);
    }

    return structure;
  }

  /**
   * 解析带编号列表的字段（如教学目标、教学准备）
   */
  parseNumberedList(fieldName, allLines) {
    const fieldIndex = allLines.findIndex(line => new RegExp(fieldName).test(line));
    if (fieldIndex === -1) {
      return null;
    }
    
    const items = [];
    let i = fieldIndex + 1;
    
    // 查找"示例图片"的位置，在此之后的内容不解析
    let exampleImageIndex = -1;
    for (let j = 0; j < allLines.length; j++) {
      if (/示例图片|示例|图片/.test(allLines[j])) {
        exampleImageIndex = j;
        break;
      }
    }
    
    // 收集编号列表项，直到遇到下一个主要字段或"示例图片"
    while (i < allLines.length && (exampleImageIndex === -1 || i < exampleImageIndex)) {
      const line = allLines[i].trim();
      
      // 如果遇到下一个主要字段，停止
      // 注意：对于"教学目标"字段，需要在遇到"教学准备"时停止，
      // 否则会把"教学准备"下面的内容也错误地算到"教学目标"里
      if (/教学目标|教学准备|绘本简介|导入环节|精读环节|拓展环节|教学过程|阅读测评/.test(line) && !new RegExp(fieldName).test(line)) {
        break;
      }
      
      // 匹配编号格式：1. 或 1。或 1、
      const numberedMatch = line.match(/^(\d+)[\.。、]\s*(.*)/);
      if (numberedMatch) {
        items.push({
          number: numberedMatch[1],
          content: numberedMatch[2].trim(),
          editable: true
        });
      } else if (line && items.length > 0) {
        // 如果当前行不是编号格式但有内容，追加到最后一个item
        const lastItem = items[items.length - 1];
        lastItem.content += (lastItem.content ? '\n' : '') + line;
      }
      
      i++;
    }
    
    return {
      name: fieldName,
      value: items.map(item => `${item.number}. ${item.content}`).join('\n'),
      items: items,
      line: fieldIndex + 1,
      editable: true,
      _rawValue: items.map(item => `${item.number}. ${item.content}`).join('\n')
    };
  }

  /**
   * 解析文本区域字段（如绘本简介）
   */
  parseTextArea(fieldName, allLines) {
    const fieldIndex = allLines.findIndex(line => new RegExp(fieldName).test(line));
    if (fieldIndex === -1) {
      return null;
    }
    
    let value = '';
    let i = fieldIndex + 1;
    
    // 查找"示例图片"的位置
    let exampleImageIndex = -1;
    for (let j = 0; j < allLines.length; j++) {
      if (/示例图片|示例|图片/.test(allLines[j])) {
        exampleImageIndex = j;
        break;
      }
    }
    
    // 收集文本内容，直到遇到下一个主要字段或"示例图片"
    while (i < allLines.length && (exampleImageIndex === -1 || i < exampleImageIndex)) {
      const line = allLines[i].trim();
      
      // 如果遇到下一个主要字段，停止
      if (/教学目标|教学准备|导入环节|精读环节|拓展环节|教学过程|阅读测评/.test(line)) {
        break;
      }
      
      if (line) {
        value += (value ? '\n' : '') + line;
      }
      
      i++;
    }
    
    return {
      name: fieldName,
      value: value,
      line: fieldIndex + 1,
      editable: true
    };
  }

  /**
   * 解析教学过程
   */
  parseProcess(lines) {
    const process = {
      type: 'process',
      title: '教学过程',
      sections: []
    };

    let currentSection = null;
    
    // 查找"示例图片"的位置，在此之后的内容不解析
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
      
      // 匹配主要环节：导入环节、精读环节、拓展环节
      if (/导入环节/.test(line)) {
        if (currentSection) {
          process.sections.push(currentSection);
        }
        currentSection = {
          type: 'import',
          title: '导入环节',
          content: ''
        };
      } else if (/精读环节/.test(line)) {
        if (currentSection) {
          process.sections.push(currentSection);
        }
        currentSection = {
          type: 'reading',
          title: '精读环节',
          items: []
        };
      } else if (/拓展环节/.test(line)) {
        if (currentSection) {
          process.sections.push(currentSection);
        }
        currentSection = {
          type: 'extension',
          title: '拓展环节',
          items: []
        };
      } else if (currentSection) {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }
        
        // 处理导入环节（简单文本内容）
        if (currentSection.type === 'import') {
          if (!/导入环节|精读环节|拓展环节|教学过程|阅读测评/.test(trimmed)) {
            currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
          }
        }
        // 处理精读环节的子项：观察封面、前环衬页、正文精读P1等
        else if (currentSection.type === 'reading') {
          // 匹配：1.观察封面、2.前环衬页、3.扉页介绍、正文精读P1等
          if (/^(\d+)\.|正文精读P(\d+)|观察封面|前环衬页|扉页介绍/.test(trimmed)) {
            currentSection.items.push({
              title: trimmed,
              content: '',
              editable: true
            });
          } else if (currentSection.items.length > 0) {
            // 追加到最后一个item的内容
            const lastItem = currentSection.items[currentSection.items.length - 1];
            lastItem.content += (lastItem.content ? '\n' : '') + trimmed;
          }
        }
        // 处理拓展环节：拓展方式1、拓展方式2等，每个方式有编号列表
        else if (currentSection.type === 'extension') {
          // 匹配：拓展方式1: XXX 或 拓展方式1：XXX
          const extensionMatch = trimmed.match(/拓展方式(\d+)[：:]\s*(.*)/);
          if (extensionMatch) {
            // 如果遇到新的拓展方式，先保存之前的（如果有）
            currentSection.items.push({
              number: extensionMatch[1],
              title: extensionMatch[2].trim() || '',
              items: [],
              editable: true
            });
          } else if (currentSection.items.length > 0) {
            // 检查是否是编号列表项（1. 或 1。或 1、）
            const numberedMatch = trimmed.match(/^(\d+)[\.。、]\s*(.*)/);
            if (numberedMatch) {
              const lastExtension = currentSection.items[currentSection.items.length - 1];
              if (!lastExtension.items) {
                lastExtension.items = [];
              }
              const content = numberedMatch[2] ? numberedMatch[2].trim() : '';
              // 只有序号没有内容时跳过（可能是格式问题）
              if (content || numberedMatch[1]) {
                lastExtension.items.push({
                  number: numberedMatch[1],
                  content: content,
                  editable: true
                });
              }
            } else if (trimmed && !/拓展方式|阅读测评|示例图片|教学过程|导入环节|精读环节/.test(trimmed)) {
              // 如果不是编号格式，追加到最后一个拓展方式的最后一个item
              const lastExtension = currentSection.items[currentSection.items.length - 1];
              if (lastExtension && lastExtension.items && lastExtension.items.length > 0) {
                const lastItem = lastExtension.items[lastExtension.items.length - 1];
                lastItem.content += (lastItem.content ? '\n' : '') + trimmed;
              } else if (lastExtension && !lastExtension.items) {
                // 如果最后一个拓展方式还没有items数组，初始化并添加第一项
                lastExtension.items = [{
                  number: '1',
                  content: trimmed,
                  editable: true
                }];
              }
            }
          }
        }
      }
    });
    
    if (currentSection) {
      process.sections.push(currentSection);
    }

    return process.sections.length > 0 ? process : null;
  }
}

