/**
 * 格式检查服务
 */

export const formatChecker = {
  /**
   * 检查文档格式
   * @param {string} text - 文档文本
   * @returns {Array} 格式问题数组
   */
  checkFormat(text) {
    const issues = [];
    const lines = text.split('\n');

    // 检查标题格式
    this.checkHeadings(lines, issues);

    // 检查段落格式
    this.checkParagraphs(lines, issues);

    // 检查标点符号
    this.checkPunctuation(text, issues);

    // 检查空格
    this.checkSpaces(text, issues);

    // 检查特殊字符
    this.checkSpecialChars(text, issues);

    return issues;
  },

  /**
   * 检查标题格式
   */
  checkHeadings(lines, issues) {
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // 检查标题是否有编号
      if (trimmed.length > 0 && trimmed.length < 50 && /^[一二三四五六七八九十\d]+[、\.]/.test(trimmed)) {
        // 标题格式检查通过
      }
    });
  },

  /**
   * 检查段落格式
   */
  checkParagraphs(lines, issues) {
    let emptyLineCount = 0;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // 检查连续空行
      if (trimmed === '') {
        emptyLineCount++;
        if (emptyLineCount > 2) {
          issues.push({
            type: 'format',
            description: `第 ${index + 1} 行附近存在过多空行`,
            line: index + 1
          });
        }
      } else {
        emptyLineCount = 0;
      }

      // 检查行首空格（中文段落通常不应有行首空格）
      if (trimmed && /^[ ]+/.test(line) && /[\u4e00-\u9fa5]/.test(trimmed)) {
        issues.push({
          type: 'format',
          description: `第 ${index + 1} 行：中文段落行首不应有空格`,
          line: index + 1
        });
      }
    });
  },

  /**
   * 检查标点符号
   */
  checkPunctuation(text, issues) {
    // 检查中英文混用标点
    const mixedPunctuation = text.match(/[，。；：！？][a-zA-Z]|[a-zA-Z][，。；：！？]/g);
    if (mixedPunctuation && mixedPunctuation.length > 0) {
      issues.push({
        type: 'punctuation',
        description: '发现中英文标点混用情况',
        count: mixedPunctuation.length
      });
    }

    // 检查是否使用了全角标点
    const halfWidthPunctuation = text.match(/[,.!?;:][\u4e00-\u9fa5]/g);
    if (halfWidthPunctuation && halfWidthPunctuation.length > 0) {
      issues.push({
        type: 'punctuation',
        description: '发现半角标点符号，建议使用全角标点',
        count: halfWidthPunctuation.length
      });
    }
  },

  /**
   * 检查空格使用
   */
  checkSpaces(text, issues) {
    // 检查中文之间的多余空格
    const extraSpaces = text.match(/[\u4e00-\u9fa5] +[\u4e00-\u9fa5]/g);
    if (extraSpaces && extraSpaces.length > 0) {
      issues.push({
        type: 'space',
        description: '发现中文之间有空格，建议去除',
        count: extraSpaces.length
      });
    }

    // 检查英文和中文之间缺少空格
    const missingSpaces = text.match(/[a-zA-Z0-9][\u4e00-\u9fa5]|[\u4e00-\u9fa5][a-zA-Z0-9]/g);
    if (missingSpaces && missingSpaces.length > 5) {
      issues.push({
        type: 'space',
        description: '建议在英文/数字与中文之间添加空格',
        count: missingSpaces.length
      });
    }
  },

  /**
   * 检查特殊字符
   */
  checkSpecialChars(text, issues) {
    // 检查是否有特殊空白字符
    if (/\u00A0/.test(text)) {
      issues.push({
        type: 'special',
        description: '发现不换行空格（&nbsp;），建议使用普通空格'
      });
    }

    // 检查是否有Tab字符
    if (/\t/.test(text)) {
      issues.push({
        type: 'special',
        description: '发现Tab字符，建议使用空格代替'
      });
    }
  }
};
