/**
 * SY002-童萌-体适能课模板解析器
 * 结构：
 * - 基本信息：课程编号、课程目标、课程材料（编号列表）
 * - 教学步骤：每个步骤包含多个游戏，每个游戏有要点（￮标记）和指导语
 */

import { BaseTemplateParser } from './BaseTemplateParser.js';

export class SY002TemplateParser extends BaseTemplateParser {
  constructor() {
    super('SY002', '童萌-体适能课模板');
  }

  /**
   * 识别模板
   */
  static identify(text) {
    return /体适能|课程编号|课程目标|课程材料|教学步骤/.test(text) && 
           !/节\s*日|活动名称|绘本|食育/.test(text);
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
    // 传入所有可能的字段模式，以便正确识别下一行是否是另一个字段
    const courseNumberField = this.parseBasicInfo(lines, [
      { name: '课程编号', pattern: /课程编号/ },
      { name: '课程目标', pattern: /课程目标/ },
      { name: '课程材料', pattern: /课程材料/ },
      { name: '教学步骤', pattern: /教学步骤/ }
    ]);
    if (courseNumberField && courseNumberField.length > 0) {
      // 只取课程编号字段
      const courseNumber = courseNumberField.find(f => f.name === '课程编号');
      if (courseNumber) {
        basicInfo.push(courseNumber);
      }
    }
    
    // 课程目标（编号列表）
    const courseObjectiveField = this.parseNumberedList('课程目标', allLines);
    if (courseObjectiveField) {
      basicInfo.push(courseObjectiveField);
    }
    
    // 课程材料（编号列表）
    const courseMaterialField = this.parseNumberedList('课程材料', allLines);
    if (courseMaterialField) {
      basicInfo.push(courseMaterialField);
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
   * 解析教学步骤
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
        // 匹配要点：支持多种前缀符号
        // 符号类型：￮、•、·、-、—、○、●、▪、▫、→
        // 数字序号：1. 2. 3. 或 1。2。3。 或 1、2、3、
        let pointContent = null;
        let pointPrefix = null;
        
        // 先匹配数字序号格式：1. 2. 3. 或 1。2。3。 或 1、2、3、
        const numberedMatch = trimmed.match(/^(\d+)([\.。、])\s*(.*)/);
        if (numberedMatch) {
          pointContent = numberedMatch[3].trim();
          pointPrefix = numberedMatch[1] + numberedMatch[2]; // 保留数字和分隔符
        } else {
          // 匹配符号前缀
          const symbolPrefixes = ['￮', '•', '·', '-', '—', '○', '●', '▪', '▫', '→'];
          for (const prefix of symbolPrefixes) {
            if (trimmed.startsWith(prefix)) {
              pointContent = trimmed.substring(prefix.length).trim();
              pointPrefix = prefix;
              break;
            }
          }
        }
        
        // 如果提取的内容包含"指导语:"，则跳过，让它进入指导语匹配逻辑
        if (pointContent && /指导语[：:]/.test(pointContent)) {
          pointContent = null;
          pointPrefix = null;
        }
        
        if (pointContent && currentGame) {
          currentGame.points.push({
            content: pointContent,
            prefix: pointPrefix || '￮', // 默认使用￮
            editable: true
          });
          return;
        }
      }
      
      // 匹配指导语：指导语：或 ￮指导语：
      if (/指导语[：:]/.test(trimmed)) {
        if (currentGame) {
          // 指导语内容可能在下一行
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
   * 将中文数字转换为数字（支持一-九十九）
   * @param {string} chinese - 中文数字
   * @returns {number} 数字，如果无法转换则返回-1
   */
  chineseToNumber(chinese) {
    const chineseNumbers = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    
    if (!chinese || chinese.length === 0) {
      return -1;
    }
    
    // 单个数字：一、二、三...九
    if (chinese.length === 1 && chineseNumbers[chinese]) {
      return chineseNumbers[chinese];
    }
    
    // 十
    if (chinese === '十') {
      return 10;
    }
    
    // 十几：十一、十二...十九
    if (chinese.length === 2 && chinese[0] === '十' && chineseNumbers[chinese[1]]) {
      return 10 + chineseNumbers[chinese[1]];
    }
    
    // 几十：二十、三十...九十
    if (chinese.length === 2 && chineseNumbers[chinese[0]] && chinese[1] === '十') {
      return chineseNumbers[chinese[0]] * 10;
    }
    
    // 几十几：二十一、二十二...九十九
    if (chinese.length === 3 && chineseNumbers[chinese[0]] && chinese[1] === '十' && chineseNumbers[chinese[2]]) {
      return chineseNumbers[chinese[0]] * 10 + chineseNumbers[chinese[2]];
    }
    
    return -1;
  }

  /**
   * 解析编号列表字段（如课程目标、课程材料）
   * 统一使用 1、（数字 + 中文顿号）格式
   */
  parseNumberedList(fieldName, allLines) {
    const fieldIndex = allLines.findIndex(line => new RegExp(fieldName).test(line));
    if (fieldIndex === -1) {
      return null;
    }
    
    const items = [];
    let i = fieldIndex + 1;
    let expectedNumber = 1; // 期望的序号（用于自动递增）
    
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
      
      let matched = false;
      
      // 统一匹配数字序号格式：支持 1、1. 1。等格式，但统一转换为 1、格式
      // 匹配：数字 + （中文顿号、英文句号、中文句号）
      const numberedMatch = line.match(/^(\d+)[、\.。]\s*(.*)/);
      if (numberedMatch) {
        const content = numberedMatch[2].trim();
        if (content) {
          // 忽略文档中的序号，直接使用递增的序号（1、2、3、...）
          items.push({
            number: String(expectedNumber),
            content: content,
            editable: true
          });
          expectedNumber++; // 递增序号
          matched = true;
        }
      }
      
      // 如果当前行不是编号格式但有内容，追加到最后一个item
      if (!matched && line && items.length > 0) {
        const lastItem = items[items.length - 1];
        lastItem.content += (lastItem.content ? '\n' : '') + line;
      }
      
      i++;
    }
    
    // 统一使用 1、格式（数字 + 中文顿号）
    return {
      name: fieldName,
      value: items.map(item => `${item.number}、${item.content}`).join('\n'),
      items: items,
      line: fieldIndex + 1,
      editable: true,
      _rawValue: items.map(item => `${item.number}、${item.content}`).join('\n')
    };
  }
}
