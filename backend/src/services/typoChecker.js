/**
 * 错别字检测服务
 * 使用常见错别字字典进行检测
 */

// 常见错别字字典（错别字 -> 正确字）
// 注意：这是一个简化的字典，实际错别字检测应该使用LLM智能体
const typoDict = {
  // 常见易混淆字（这些词本身不是错别字，但在某些语境下可能用错）
  // 注意：由于需要语境判断，传统方法只能检测明显的错别字
  
  // 可以添加更多明显的错别字
};

/**
 * 检测文本中的错别字
 */
export const typoChecker = {
  /**
   * 检查文本中的错别字
   * @param {string} text - 要检查的文本
   * @returns {Array} 错别字结果数组
   * 
   * 注意：传统方法只能检测明显的错别字，建议使用LLM智能体进行更准确的检测
   */
  async checkTypos(text) {
    const results = [];
    
    // 传统方法检测能力有限，主要作为LLM失败时的降级方案
    // 这里只检测一些明显的、不需要语境的错别字
    
    // 检测常见的明显错别字模式
    const commonTypos = [
      // 可以添加一些明显的错别字模式，但需要谨慎，避免误报
    ];
    
    // 由于传统方法检测能力有限，返回空结果
    // 实际错别字检测应该依赖LLM智能体
    console.log('⚠️  使用传统方法检测错别字（能力有限，建议使用LLM智能体）');
    
    return results;
  },

  /**
   * 提取文本中的词语
   */
  extractWords(text) {
    const words = [];
    // 简单的分词（中文字符和词语）
    const wordRegex = /[\u4e00-\u9fa5]+/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        position: match.index,
        length: match[0].length
      });
    }
    
    return words;
  },

  /**
   * 获取错别字的上下文
   */
  getContext(text, position, contextLength) {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end);
  }
};
