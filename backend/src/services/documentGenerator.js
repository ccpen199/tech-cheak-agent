/**
 * 文档生成器
 * 根据编辑后的结构生成新的Word文档
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
  VerticalMergeType
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 根据编辑后的结构生成Word文档
 * @param {Object} structure - 编辑后的文档结构
 * @param {string} templateId - 模板ID
 * @param {Object} documentInfo - 文档信息（编号、名称）
 * @param {string} originalTemplatePath - 原始模板文件路径（可选，用于提取"示例图片"后的内容）
 * @returns {Promise<string>} 生成的文档路径
 */
export async function generateDocumentFromStructure(structure, templateId, documentInfo, originalTemplatePath = null) {
  try {
    // 从templateId中提取模版ID（可能是完整文件名如 "SY004-童萌-绘本剧模板.docx" 或直接是 "SY004"）
    let extractedTemplateId = templateId;
    if (templateId?.startsWith('SY004')) {
      extractedTemplateId = 'SY004';
    } else if (templateId?.startsWith('SY002')) {
      extractedTemplateId = 'SY002';
    } else if (templateId?.startsWith('SY005')) {
      extractedTemplateId = 'SY005';
    }
    
    // SY004模板使用独立的生成逻辑（4列表格结构）
    if (extractedTemplateId === 'SY004') {
      const { generateSY004Document } = await import('./sy004DocumentGenerator.js');
      return await generateSY004Document(structure, documentInfo, originalTemplatePath);
    }
    
    // SY002和SY005使用段落格式（不使用表格）
    if (extractedTemplateId === 'SY002' || extractedTemplateId === 'SY005') {
      return await generateSY002SY005Document(structure, documentInfo, originalTemplatePath, extractedTemplateId);
    }
    
    // SY001和SY003使用通用生成逻辑（表格格式）

    const children = [];

    // 默认字体设置：微软雅黑 5号（10.5pt = 21 half-points）
    const defaultFont = '微软雅黑';
    const defaultSize = 21; // 5号字体 = 10.5pt = 21 half-points

    // 提取模板前的信息（文档编号和作者）
    if (originalTemplatePath && fs.existsSync(originalTemplatePath)) {
      try {
        const headerInfo = await extractHeaderInfo(originalTemplatePath);
        if (headerInfo.documentNumber) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headerInfo.documentNumber,
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ],
              spacing: { after: 200 }
            })
          );
        }
        if (headerInfo.author) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headerInfo.author,
                  font: defaultFont,
                  size: defaultSize
                })
              ],
              spacing: { after: 400 }
            })
          );
        }
      } catch (error) {
        console.warn('提取模板头部信息失败:', error.message);
      }
    }

    // 不添加文档名称，因为模板中已经包含了

    // 收集基本信息和环节流程/教学步骤，合并到一个表格中
    let basicInfoFields = null;
    let segments = null;
    let teachingSteps = null; // SY002和SY005使用
    
    if (structure.sections) {
      structure.sections.forEach(section => {
        if (section.type === 'basic_info' && section.fields) {
          basicInfoFields = section.fields;
        }
        if (section.type === 'segments' && section.items) {
          segments = section.items;
        }
        if (section.type === 'teaching_steps' && section.items) {
          teachingSteps = section.items;
        }
      });
    }

    // 如果既有基本信息又有环节流程或教学步骤，合并到一个表格中
    // SY002和SY005使用teachingSteps，其他使用segments
    const itemsToProcess = teachingSteps || segments;
    const isTeachingSteps = !!teachingSteps;
    
    if (basicInfoFields && itemsToProcess && itemsToProcess.length > 0) {
      const allRows = [];
      
      // 1. 基本信息行（3列：标签 | 值（合并2列））
      basicInfoFields.forEach(field => {
        // 处理编号列表字段（课程目标、课程材料）- 参考SY004的实现
        const fieldParagraphs = [];
        
        if (field._rawValue) {
          // 如果有原始值，按行分割并创建段落（保持用户输入的格式）
          const lines = field._rawValue.split('\n');
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              fieldParagraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: trimmed,
                      font: defaultFont,
                      size: defaultSize
                    })
                  ]
                })
              );
            }
          });
        } else if (field.items && field.items.length > 0) {
          // 如果有items数组，为每个item创建段落
          // SY002模板统一使用 1、格式（数字 + 中文顿号），其他模板使用 1. 格式
          const separator = (extractedTemplateId === 'SY002' && (field.name === '课程目标' || field.name === '课程材料')) ? '、' : '.';
          field.items.forEach(item => {
            const text = item.noNumber 
              ? (item.content || '')
              : `${item.number}${separator} ${item.content || ''}`;
            if (text.trim()) {
              fieldParagraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: text,
                      font: defaultFont,
                      size: defaultSize
                    })
                  ]
                })
              );
            }
          });
        } else {
          // 普通字段，使用value
          if (field.value) {
            field.value.split('\n').forEach(line => {
              if (line.trim()) {
                fieldParagraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: line.trim(),
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                );
              }
            });
          }
        }
        
        // 如果没有内容，至少创建一个空段落
        if (fieldParagraphs.length === 0) {
          fieldParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '',
                  font: defaultFont,
                  size: defaultSize
                })
              ]
            })
          );
        }
        
        allRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: field.name,
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  })
                ],
                width: { size: 1515, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              }),
              new TableCell({
                children: fieldParagraphs,
                columnSpan: 2,
                width: { size: 6765, type: WidthType.DXA },
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              })
            ]
          })
        );
      });

      // 2. 环节流程/教学步骤行
      itemsToProcess.forEach((segment, segmentIndex) => {
        // SY002和SY005的教学步骤结构不同，需要特殊处理
        if (isTeachingSteps && segment.games) {
          // 处理教学步骤（每个步骤包含多个游戏）
          generateTeachingStepRows(segment, segmentIndex, allRows, defaultFont, defaultSize);
        } else {
          // 处理传统的环节流程
        // 计算这个环节需要多少行（标题+时间 + 操作方法 + 主/助教分工 + 教师指导语）
        let segmentRowCount = 1; // 至少有一行（标题+时间）
        if (segment.method) segmentRowCount++;
        if (segment.division) segmentRowCount++;
        if (segment.guidance) segmentRowCount++;

        // 第一行：环节标题 + 时间（第一列是"环节流程"，垂直合并）
        allRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: segmentIndex === 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '环节流程',
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  })
                ] : [],
                verticalMerge: segmentIndex === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
                width: { size: 1515, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `环节${segment.number}：${segment.title || ''}`,
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.LEFT
                  })
                ],
                width: { size: 5737, type: WidthType.DXA },
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: segment.time ? `${segment.time}分钟` : '',
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  })
                ],
                width: { size: 1028, type: WidthType.DXA },
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              })
            ]
          })
        );

        // 操作方法
        if (segment.method) {
          const methodParagraphs = [];
          // 标签段落（前面加空格）
          methodParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '• 操作方法：',
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ]
            })
          );
          
          // 将每个序号项创建为独立的段落
          const items = segment.method._rawValue 
            ? segment.method._rawValue.split('\n').filter(line => line.trim())
            : (segment.method.items || []);
          
          if (segment.method._rawValue) {
            // 如果有原始值，按行分割并创建段落
            const lines = segment.method._rawValue.split('\n');
            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed) {
                methodParagraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: trimmed,
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                );
              }
            });
          } else {
            // 如果有items数组，为每个item创建段落
            items.forEach(item => {
              const text = item.noNumber 
                ? (item.content || '')
                : `${item.number}. ${item.content || ''}`;
              if (text.trim()) {
                methodParagraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: text,
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                );
              }
            });
          }
          
          allRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [],
                  verticalMerge: VerticalMergeType.CONTINUE,
                  width: { size: 1515, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 30, left: 120, right: 120 }
                }),
                new TableCell({
                  children: methodParagraphs,
                  columnSpan: 2,
                  width: { size: 6765, type: WidthType.DXA },
                  margins: { top: 60, bottom: 30, left: 120, right: 120 }
                })
              ]
            })
          );
        }

        // 主/助教分工
        if (segment.division) {
          allRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [],
                  verticalMerge: VerticalMergeType.CONTINUE,
                  width: { size: 1515, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 30, left: 120, right: 120 }
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '主/助教分工：',
                          font: defaultFont,
                          size: defaultSize,
                          bold: true
                        })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: segment.division.value || '',
                          font: defaultFont,
                          size: defaultSize
                        })
                      ]
                    })
                  ],
                  columnSpan: 2,
                  width: { size: 6765, type: WidthType.DXA },
                  margins: { top: 60, bottom: 30, left: 120, right: 120 }
                })
              ]
            })
          );
        }

        // 教师指导语
        if (segment.guidance) {
          const guidanceParagraphs = [];
          // 标签段落（前面加空格）
          guidanceParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '• 教师指导语：',
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ]
            })
          );
          
          // 将每个序号项创建为独立的段落
          const items = segment.guidance._rawValue 
            ? segment.guidance._rawValue.split('\n').filter(line => line.trim())
            : (segment.guidance.items || []);
          
          if (segment.guidance._rawValue) {
            // 如果有原始值，按行分割并创建段落
            const lines = segment.guidance._rawValue.split('\n');
            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed) {
                guidanceParagraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: trimmed,
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                );
              }
            });
          } else {
            // 如果有items数组，为每个item创建段落
            items.forEach(item => {
              const text = item.noNumber 
                ? (item.content || '')
                : `${item.number}. ${item.content || ''}`;
              if (text.trim()) {
                guidanceParagraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: text,
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                );
              }
            });
          }
          
          allRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [],
                  verticalMerge: VerticalMergeType.CONTINUE,
                  width: { size: 1515, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 30, left: 120, right: 120 }
                }),
                new TableCell({
                  children: guidanceParagraphs,
                  columnSpan: 2,
                  width: { size: 6765, type: WidthType.DXA },
                  margins: { top: 60, bottom: 30, left: 120, right: 120 }
                })
              ]
            })
          );
        }
        }
      });

      // 创建合并后的表格
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: allRows,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: 'DEE0E3' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DEE0E3' },
            left: { style: BorderStyle.SINGLE, size: 6, color: 'DEE0E3' },
            right: { style: BorderStyle.SINGLE, size: 6, color: 'DEE0E3' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: 'DEE0E3' },
            insideVertical: { style: BorderStyle.SINGLE, size: 3, color: 'DEE0E3' }
          }
        })
      );
    } else {
      // 如果没有环节流程，只显示基本信息（保持原有逻辑）
      if (basicInfoFields) {
        const basicRows = basicInfoFields.map(field => (
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: field.name,
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                ],
                width: { size: 30, type: WidthType.PERCENTAGE },
                margins: { top: 120, bottom: 120, left: 200, right: 200 }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: field.value || '',
                        font: defaultFont,
                        size: defaultSize
                      })
                    ]
                  })
                ],
                width: { size: 70, type: WidthType.PERCENTAGE },
                margins: { top: 120, bottom: 120, left: 200, right: 200 }
              })
            ]
          })
        ));

        children.push(
          new Table({
            width: { size: 0, type: WidthType.AUTO },
            rows: basicRows,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 2, color: 'DEE0E3' },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DEE0E3' },
              left: { style: BorderStyle.SINGLE, size: 2, color: 'DEE0E3' },
              right: { style: BorderStyle.SINGLE, size: 2, color: 'DEE0E3' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DEE0E3' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'DEE0E3' }
            }
          })
        );
      }
    }

    // 如果是SY001、SY002、SY003或SY005模板且有原始模板路径，提取"示例图片"后的内容
    if ((extractedTemplateId === 'SY001' || extractedTemplateId === 'SY002' || extractedTemplateId === 'SY003' || extractedTemplateId === 'SY005') && originalTemplatePath && fs.existsSync(originalTemplatePath)) {
      try {
        const exampleImageContent = await extractExampleImageContent(originalTemplatePath);
        if (exampleImageContent && exampleImageContent.length > 0) {
          children.push(...exampleImageContent);
        }
      } catch (error) {
        console.warn('提取示例图片内容失败:', error.message);
      }
    }

    // 创建文档
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              size: defaultSize, // 5号字体 = 10.5pt = 21 half-points
              font: defaultFont,
              eastAsia: defaultFont, // 微软雅黑
              ascii: defaultFont // 微软雅黑也支持ASCII字符
            }
          }
        }
      },
      sections: [{
        properties: {},
        children
      }]
    });

    // 保存文档（不覆盖原文件）
    const processedDir = path.join(__dirname, '../../processed');
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = documentInfo?.name 
      ? `${documentInfo.name}-${timestamp}.docx`
      : `edited-document-${timestamp}.docx`;
    const outputPath = path.join(processedDir, fileName);

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
  } catch (error) {
    console.error('生成文档错误:', error);
    throw error;
  }
}

/**
 * 生成教学步骤行（SY002和SY005使用）
 * @param {Object} step - 教学步骤对象
 * @param {number} stepIndex - 步骤索引
 * @param {Array} allRows - 所有行的数组
 * @param {string} defaultFont - 默认字体
 * @param {number} defaultSize - 默认字体大小
 */
function generateTeachingStepRows(step, stepIndex, allRows, defaultFont, defaultSize) {
  const stepParagraphs = [];
  
  // 步骤标题：1. 热身+引入
  stepParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${step.number}. ${step.title || ''}`,
          font: defaultFont,
          size: defaultSize,
          bold: true
        })
      ]
    })
  );
  
  // 处理每个游戏
  if (step.games && step.games.length > 0) {
    step.games.forEach((game, gameIndex) => {
      // 判断是否是"结束整理"的特殊格式（a.引导整理、b.课程总结）
      const isSubItem = /^[a-z]$/.test(game.number);
      
      if (isSubItem) {
        // 特殊格式：a.引导整理：或 b.课程总结：
        stepParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${game.number}.${game.title}：`,
                font: defaultFont,
                size: defaultSize,
                bold: true
              })
            ]
          })
        );
      } else {
        // 普通游戏标题：游戏1：xxx
        if (game.title) {
          stepParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `游戏${game.number || gameIndex + 1}：${game.title}`,
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ]
            })
          );
        }
      }
      
      // 游戏要点（￮标记）
      if (game.points && game.points.length > 0) {
        game.points.forEach(point => {
          if (point.content) {
            stepParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `￮ ${point.content}`,
                    font: defaultFont,
                    size: defaultSize
                  })
                ]
              })
            );
          }
        });
      }
      
      // 指导语
      if (game.guidance) {
        stepParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `指导语：${game.guidance}`,
                font: defaultFont,
                size: defaultSize
              })
            ]
          })
        );
      }
    });
  }
  
  // 创建表格行
  allRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: stepIndex === 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: '教学步骤',
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ],
              alignment: AlignmentType.CENTER
            })
          ] : [],
          verticalMerge: stepIndex === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
          width: { size: 1515, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 30, left: 120, right: 120 }
        }),
        new TableCell({
          children: stepParagraphs,
          columnSpan: 2,
          width: { size: 6765, type: WidthType.DXA },
          margins: { top: 60, bottom: 30, left: 120, right: 120 }
        })
      ]
    })
  );
}

/**
 * 提取模板头部信息（文档编号和作者）
 * @param {string} templatePath - 模板文件路径
 * @returns {Promise<Object>} 包含文档编号和作者的对象
 */
async function extractHeaderInfo(templatePath) {
  try {
    const textResult = await mammoth.extractRawText({ path: templatePath });
    const text = textResult.value;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const headerInfo = {
      documentNumber: null,
      author: null
    };
    
    // 查找文档编号（格式如：JQ001-xxxx）
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // 匹配格式：字母数字-任意字符
      if (/^[A-Z]+\d+-.+/.test(line)) {
        headerInfo.documentNumber = line;
        break;
      }
    }
    
    // 查找作者（格式如：作  者：）
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      if (/作\s*者\s*：/.test(line)) {
        headerInfo.author = line;
        break;
      }
    }
    
    return headerInfo;
  } catch (error) {
    console.warn('提取模板头部信息时出错:', error.message);
    return { documentNumber: null, author: null };
  }
}

async function extractExampleImageContent(templatePath) {
  const content = [];
  
  // 默认字体设置：微软雅黑 5号（10.5pt = 21 half-points）
  const defaultFont = '微软雅黑';
  const defaultSize = 21; // 5号字体 = 10.5pt = 21 half-points
  
  try {
    // 使用mammoth提取文本，找到"示例图片"的位置
    const textResult = await mammoth.extractRawText({ path: templatePath });
    const text = textResult.value;
    const lines = text.split('\n');
    
    let exampleImageIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/示例图片|示例|图片/.test(lines[i])) {
        exampleImageIndex = i;
        break;
      }
    }
    
    if (exampleImageIndex === -1) {
      return content; // 没有找到"示例图片"
    }
    
    // 提取"示例图片"后的文本内容
    const remainingLines = lines.slice(exampleImageIndex);
    if (remainingLines.length > 1) {
      // 跳过"示例图片"这一行，添加后续内容
      for (let i = 1; i < remainingLines.length; i++) {
        const line = remainingLines[i].trim();
        if (line) {
          content.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font: defaultFont,
                  size: defaultSize
                })
              ],
              spacing: { after: 200 }
            })
          );
        }
      }
    }
    
    // 尝试提取图片（从docx的media文件夹）
    try {
      const zip = new AdmZip(templatePath);
      const zipEntries = zip.getEntries();
      
      // 查找图片文件
      const imageEntries = zipEntries.filter(entry => 
        entry.entryName.startsWith('word/media/') && 
        /\.(jpg|jpeg|png|gif|bmp)$/i.test(entry.entryName)
      );
      
      // 注意：docx库的ImageRun需要图片的Buffer，但这里我们只能从zip中提取
      // 由于docx库的限制，我们暂时只添加文本内容
      // 如果需要添加图片，需要更复杂的处理（保存图片到临时文件，然后使用ImageRun）
      
    } catch (zipError) {
      console.warn('无法从模板中提取图片:', zipError.message);
    }
    
  } catch (error) {
    console.warn('提取示例图片内容时出错:', error.message);
  }
  
  return content;
}

/**
 * 生成SY002和SY005文档（段落格式，不使用表格）
 * @param {Object} structure - 编辑后的文档结构
 * @param {Object} documentInfo - 文档信息（编号、名称）
 * @param {string} originalTemplatePath - 原始模板文件路径
 * @param {string} templateId - 模板ID（SY002或SY005）
 * @returns {Promise<string>} 生成的文档路径
 */
async function generateSY002SY005Document(structure, documentInfo, originalTemplatePath, templateId) {
  const children = [];
  
  // 默认字体设置：微软雅黑 5号（10.5pt = 21 half-points）
  const defaultFont = '微软雅黑';
  const defaultSize = 21; // 5号字体 = 10.5pt = 21 half-points
  
  // 提取模板前的信息（文档编号和作者）
  if (originalTemplatePath && fs.existsSync(originalTemplatePath)) {
    try {
      const headerInfo = await extractHeaderInfo(originalTemplatePath);
      if (headerInfo.documentNumber) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: headerInfo.documentNumber,
                font: defaultFont,
                size: defaultSize,
                bold: true
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
      if (headerInfo.author) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: headerInfo.author,
                font: defaultFont,
                size: defaultSize
              })
            ],
            spacing: { after: 400 }
          })
        );
      }
    } catch (error) {
      console.warn('提取模板头部信息失败:', error.message);
    }
  }
  
  // 收集基本信息
  let basicInfoFields = null;
  let teachingSteps = null;
  
  if (structure.sections) {
    structure.sections.forEach(section => {
      if (section.type === 'basic_info' && section.fields) {
        basicInfoFields = section.fields;
      }
      if (section.type === 'teaching_steps' && section.items) {
        teachingSteps = section.items;
      }
    });
  }
  
  // 生成基本信息（段落格式）
  if (basicInfoFields) {
    basicInfoFields.forEach(field => {
      // 判断是否是编号列表字段（课程目标、课程材料）
      const isNumberedList = field.items && field.items.length > 0;
      
      if (isNumberedList) {
        // 编号列表字段：标题单独一行（加粗），然后每个编号项一行
        const fieldTitle = `${field.name}：`;
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: fieldTitle,
                font: defaultFont,
                size: defaultSize,
                bold: true
              })
            ],
            spacing: { after: 100 }
          })
        );
        
        // 编号列表项
        if (field._rawValue) {
          // 如果有原始值，按行分割并创建段落
          const lines = field._rawValue.split('\n');
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: trimmed,
                      font: defaultFont,
                      size: defaultSize
                    })
                  ],
                  spacing: { after: 100 }
                })
              );
            }
          });
        } else if (field.items && field.items.length > 0) {
          // 如果有items数组，为每个item创建段落
          // SY002和SY005统一使用 1. 格式（数字 + 英文句号 + 空格）
          field.items.forEach(item => {
            const text = item.noNumber 
              ? (item.content || '')
              : `${item.number}. ${item.content || ''}`;
            if (text.trim()) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: text,
                      font: defaultFont,
                      size: defaultSize
                    })
                  ],
                  spacing: { after: 100 }
                })
              );
            }
          });
        }
      } else {
        // 普通字段（如课程编号）：标题和值在同一行
        const fieldTitle = `${field.name}：`;
        let fieldValue = '';
        
        if (field._rawValue) {
          fieldValue = field._rawValue.trim().replace(/\n/g, ' ');
        } else if (field.value) {
          fieldValue = field.value.trim().replace(/\n/g, ' ');
        }
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: fieldTitle,
                font: defaultFont,
                size: defaultSize,
                bold: true
              }),
              new TextRun({
                text: fieldValue,
                font: defaultFont,
                size: defaultSize
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
    });
  }
  
  // 生成教学步骤（段落格式）
  if (teachingSteps && teachingSteps.length > 0) {
    // 教学步骤标题
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '教学步骤：',
            font: defaultFont,
            size: defaultSize,
            bold: true
          })
        ],
        spacing: { after: 200 }
      })
    );
    
    // 处理每个教学步骤
    teachingSteps.forEach(step => {
      // 步骤标题：1. 热身+引入
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${step.number}. ${step.title || ''}`,
              font: defaultFont,
              size: defaultSize,
              bold: true
            })
          ],
          spacing: { after: 100 }
        })
      );
      
      // 处理每个游戏
      if (step.games && step.games.length > 0) {
        step.games.forEach((game, gameIndex) => {
          // 判断是否是"结束整理"的特殊格式（a.引导整理、b.课程总结）
          const isSubItem = /^[a-z]$/.test(game.number);
          
          if (isSubItem) {
            // 特殊格式：a.引导整理：或 b.课程总结：
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${game.number}.${game.title}：`,
                    font: defaultFont,
                    size: defaultSize,
                    bold: true
                  })
                ],
                spacing: { after: 100 }
              })
            );
          } else {
            // 普通游戏标题：游戏1：xxx
            if (game.title) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `游戏${game.number || gameIndex + 1}：${game.title}`,
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  spacing: { after: 100 }
                })
              );
            }
          }
          
          // 游戏要点（使用￮标记）
          if (game.points && game.points.length > 0) {
            game.points.forEach(point => {
              if (point.content) {
                // 使用解析器返回的前缀，如果没有则默认使用￮
                const prefix = point.prefix || '￮';
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${prefix} ${point.content}`,
                        font: defaultFont,
                        size: defaultSize
                      })
                    ],
                    spacing: { after: 100 }
                  })
                );
              }
            });
          }
          
          // 指导语
          if (game.guidance) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `￮ 指导语：${game.guidance}`,
                    font: defaultFont,
                    size: defaultSize
                  })
                ],
                spacing: { after: 100 }
              })
            );
          } else if (isSubItem) {
            // 对于结束整理的特殊格式，即使没有指导语内容也显示
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: '￮ 指导语：',
                    font: defaultFont,
                    size: defaultSize
                  })
                ],
                spacing: { after: 100 }
              })
            );
          }
        });
      }
      
      // 步骤之间添加空行
      children.push(
        new Paragraph({
          spacing: { after: 200 }
        })
      );
    });
  }
  
  // 提取"示例图片"后的内容
  if (originalTemplatePath && fs.existsSync(originalTemplatePath)) {
    try {
      const exampleImageContent = await extractExampleImageContent(originalTemplatePath);
      if (exampleImageContent && exampleImageContent.length > 0) {
        children.push(...exampleImageContent);
      }
    } catch (error) {
      console.warn('提取示例图片内容失败:', error.message);
    }
  }
  
  // 创建文档
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            size: defaultSize,
            font: defaultFont,
            eastAsia: defaultFont,
            ascii: defaultFont
          }
        }
      }
    },
    sections: [{
      properties: {},
      children
    }]
  });
  
  // 保存文档
  const processedDir = path.join(__dirname, '../../processed');
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const fileName = documentInfo?.name 
    ? `${documentInfo.name}-${timestamp}.docx`
    : `edited-document-${timestamp}.docx`;
  const outputPath = path.join(processedDir, fileName);
  
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  
  return outputPath;
}

