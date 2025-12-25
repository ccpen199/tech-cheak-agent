/**
 * SY001 童萌-节庆活动方案模板 格式规范配置
 * 基于用户提供的模板结构
 */

export const SY001_SPEC = {
  id: 'SY001',
  name: '童萌-节庆活动方案模板',
  identifiers: ['节庆活动方案模板', '童萌-节庆活动方案模板'],
  
  // 基本信息区域（表格形式）
  basicInfo: {
    fields: [
      {
        name: '节日',
        pattern: /节\s*日/,
        required: true,
        type: 'text',
        message: '缺少"节日"字段'
      },
      {
        name: '活动名称',
        pattern: /活动名称/,
        required: true,
        type: 'text',
        message: '缺少"活动名称"字段'
      },
      {
        name: '材料',
        pattern: /材\s*料/,
        required: true,
        type: 'text',
        message: '缺少"材料"字段'
      }
    ]
  },
  
  // 环节流程格式规则
  segmentRules: {
    // 环节标题格式
    title: {
      pattern: /^环节\d+[：:]\s*.+/,
      required: true,
      message: '环节标题格式应为"环节X：标题内容"（X为数字）',
      examples: {
        correct: ['环节1：学习古诗《元日》', '环节2：xxx'],
        incorrect: ['环节一：', '环节1', '环节 1：']
      }
    },
    
    // 时间标注格式
    time: {
      pattern: /\d+\s*分钟/,
      required: true,
      message: '每个环节应标注时间（如：10分钟）',
      examples: {
        correct: ['10分钟', '15分钟'],
        incorrect: ['10 分钟', '十分钟', '10min']
      }
    },
    
    // 操作方法格式
    method: {
      titlePattern: /^[•·]\s*操作方法[：:]/,
      listPattern: /^\d+\.\s+.+[。.]/,
      required: true,
      minItems: 1,
      message: '操作方法应使用数字序号（1. 2. 3.），每项以句号结尾',
      examples: {
        correct: ['1. xxxx。', '2. xxx。', '3. xxxx。'],
        incorrect: ['1。', '1、', '一、', '1.']
      }
    },
    
    // 主/助教分工格式
    division: {
      titlePattern: /^[•·]\s*主\/助教分工[：:]/,
      required: true,
      type: 'text',
      message: '缺少"主/助教分工"字段',
      examples: {
        correct: ['主xxxx', 'xxx'],
        incorrect: ['主/助教分工'] // 只有标题没有内容
      }
    },
    
    // 教师指导语格式
    guidance: {
      titlePattern: /^[•·]\s*教师指导语[：:]/,
      listPattern: /^\d+\.\s+.+/,
      required: true,
      minItems: 1,
      message: '教师指导语应使用数字序号（1. 2. 3.）',
      examples: {
        correct: ['1. xxxxxx', '2. xxxxxxxxx。'],
        incorrect: ['1。', '1、', '一、']
      }
    }
  },
  
  // 验证规则
  validationRules: [
    {
      name: '环节数量',
      check: (text) => {
        const matches = text.match(/环节\d+[：:]/g);
        return matches && matches.length >= 1;
      },
      message: '至少应包含1个环节'
    },
    {
      name: '环节完整性',
      check: (text) => {
        // 检查每个环节是否包含必需的子项
        const segments = text.split(/环节\d+[：:]/);
        if (segments.length < 2) return false;
        
        // 检查每个环节（除了第一个分割前的部分）
        for (let i = 1; i < segments.length; i++) {
          const segment = segments[i];
          const hasMethod = /[•·]\s*操作方法[：:]/.test(segment);
          const hasDivision = /[•·]\s*主\/助教分工[：:]/.test(segment);
          const hasGuidance = /[•·]\s*教师指导语[：:]/.test(segment);
          
          if (!hasMethod || !hasDivision || !hasGuidance) {
            return false;
          }
        }
        return true;
      },
      message: '每个环节应包含：操作方法、主/助教分工、教师指导语'
    }
  ]
};

/**
 * 识别是否为SY001模板
 */
export function isSY001Template(text, filename) {
  // 文件名匹配
  if (filename && /SY001|节庆活动方案模板/.test(filename)) {
    return true;
  }
  
  // 内容匹配
  if (text) {
    return SY001_SPEC.identifiers.some(id => text.includes(id));
  }
  
  return false;
}

