/**
 * SY005-童萌-食育课模板解析器
 * 结构：
 * - 基本信息：课程编号、课程目标（编号列表）、课程材料（分类：实物教具、视觉教具、工具类）
 * - 教学步骤：每个步骤包含多个游戏，每个游戏有要点（￮标记）和指导语
 */

import { BaseTemplateParser } from './BaseTemplateParser.js';

export class SY005TemplateParser extends BaseTemplateParser {
  constructor() {
    super('SY005', '童萌-食育课模板');
  }

  /**
   * 识别模板
   */
  static identify(text) {
    return /食育|课程编号|课程目标|课程材料|教学步骤/.test(text) && 
           !/节\s*日|活动名称|绘本|体适能/.test(text);
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
    // 课程编号是普通字段，课程目标和课程材料是编号列表
    const basicInfo = [];
    
    // 课程编号
    const courseNumberField = this.parseBasicInfo(lines, [
      { name: '课程编号', pattern: /课程编号/ }
    ]);
    if (courseNumberField && courseNumberField.length > 0) {
      basicInfo.push(courseNumberField[0]);
    }
    
    // 课程目标（编号列表）
    const courseObjectiveField = this.parseNumberedList('课程目标', allLines);
    if (courseObjectiveField) {
      basicInfo.push(courseObjectiveField);
    }
    
    // 课程材料（编号列表，但SY005有分类：实物教具、视觉教具、工具类）
    // 先尝试解析为编号列表，如果失败则作为普通文本
    const courseMaterialField = this.parseNumberedList('课程材料', allLines);
    if (courseMaterialField) {
      basicInfo.push(courseMaterialField);
    } else {
      // 如果解析编号列表失败，尝试作为普通字段
      const materialField = this.parseBasicInfo(lines, [
        { name: '课程材料', pattern: /课程材料/ }
      ]);
      if (materialField && materialField.length > 0) {
        basicInfo.push(materialField[0]);
      }
    }
    
    if (basicInfo.length > 0) {
      structure.sections.push({
        type: 'basic_info',
        title: '基本信息',
        fields: basicInfo
      });
    }

    // 识别教学步骤
    const teachingSteps = this.parseTeachingSteps(allLines);
    if (teachingSteps.length > 0) {
      structure.sections.push({
        type: 'teaching_steps',
        title: '教学步骤',
        items: teachingSteps
      });
    }

    return structure;
  }

  /**
   * 解析教学步骤（与SY002相同）
   */
  parseTeachingSteps(lines) {
    const steps = [];
    let currentStep = null;
    let currentGame = null;
    
    // 查找"示例图片"的位置
    let exampleImageIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/示例图片|示例|图片/.test(lines[i])) {
        exampleImageIndex = i;
        break;
      }
    }
    
    lines.forEach((line, index) => {
      if (exampleImageIndex !== -1 && index >= exampleImageIndex) {
        return;
      }
      
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // 匹配教学步骤：1. 热身+引入
      const stepMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
      if (stepMatch) {
        // 保存上一个步骤
        if (currentStep) {
          if (currentGame) {
            currentStep.games.push(currentGame);
            currentGame = null;
          }
          steps.push(currentStep);
        }
        
        currentStep = {
          number: stepMatch[1],
          title: stepMatch[2].trim(),
          games: [],
          editable: true
        };
        currentGame = null;
        return;
      }
      
      // 判断是否是"结束整理"步骤
      const isEndingStep = currentStep && /结束整理/.test(currentStep.title);
      
      // 如果是结束整理步骤，先匹配"引导整理："或"课程总结："（不是游戏）
      if (isEndingStep) {
        const endItemMatch = trimmed.match(/^(引导整理|课程总结)[：:]?/);
        if (endItemMatch) {
          if (currentGame) {
            currentStep.games.push(currentGame);
          }
          // 作为特殊子项处理（不是游戏，但使用games数组存储）
          currentGame = {
            number: endItemMatch[1] === '引导整理' ? 'a' : 'b',
            title: endItemMatch[1],
            points: [], // 结束整理的子项没有要点
            guidance: '', // 只有指导语
            editable: true,
            isEndingItem: true // 标记为结束整理子项
          };
          return;
        }
      }
      
      // 匹配游戏：游戏1：xxx 或 游戏2：xxx
      const gameMatch = trimmed.match(/游戏(\d+)[：:]\s*(.+)/);
      if (gameMatch && currentStep && !isEndingStep) {
        if (currentGame) {
          currentStep.games.push(currentGame);
        }
        currentGame = {
          number: gameMatch[1],
          title: gameMatch[2].trim(),
          points: [], // 要点（￮标记）
          guidance: '', // 指导语
          editable: true
        };
        return;
      }
      
      // 如果是结束整理子项，只处理指导语，不处理要点
      const isEndingItem = currentGame && currentGame.isEndingItem;
      
      if (!isEndingItem) {
        // 匹配要点：￮Xxx
        if (trimmed.startsWith('￮') || trimmed.startsWith('•') || trimmed.startsWith('·')) {
          const pointContent = trimmed.substring(1).trim();
          if (currentGame && pointContent) {
            currentGame.points.push({
              content: pointContent,
              editable: true
            });
          }
          return;
        }
      }
      
      // 匹配指导语：指导语：或 ￮指导语：
      if (/指导语[：:]/.test(trimmed)) {
        if (currentGame) {
          currentGame.guidance = '';
          currentGame.guidanceFound = true;
        }
        return;
      }
      
      // 如果当前游戏正在收集指导语
      if (currentGame && currentGame.guidanceFound) {
        // 对于结束整理子项，遇到新的"引导整理："或"课程总结："时停止收集
        const isNewEndItem = /^(引导整理|课程总结)[：:]?/.test(trimmed);
        if (!isNewEndItem && !/游戏\d+|指导语|^\d+\./.test(trimmed)) {
          currentGame.guidance += (currentGame.guidance ? '\n' : '') + trimmed;
        } else {
          currentGame.guidanceFound = false;
          // 如果是新的结束整理子项，需要重新处理
          if (isNewEndItem) {
            return; // 让外层循环重新处理这一行
          }
        }
        return;
      }
    });
    
    // 保存最后一个步骤和游戏
    if (currentStep) {
      if (currentGame) {
        currentStep.games.push(currentGame);
      }
      steps.push(currentStep);
    }

    return steps;
  }

  /**
   * 解析编号列表字段（如课程目标、课程材料）
   */
  parseNumberedList(fieldName, allLines) {
    const fieldIndex = allLines.findIndex(line => new RegExp(fieldName).test(line));
    if (fieldIndex === -1) {
      return null;
    }
    
    const items = [];
    let i = fieldIndex + 1;
    
    // 查找"示例图片"的位置
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
      if (/课程编号|课程目标|课程材料|教学步骤/.test(line) && !new RegExp(fieldName).test(line)) {
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
}
