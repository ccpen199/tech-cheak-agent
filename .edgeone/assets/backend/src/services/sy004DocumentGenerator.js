/**
 * SY004模板文档生成器（独立文件，确保解耦）
 * 4列表格结构：1545, 4320, 1200, 1215 DXA
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
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

// 默认字体设置：微软雅黑 5号（10.5pt = 21 half-points）
const defaultFont = '微软雅黑';
const defaultSize = 21; // 5号字体 = 10.5pt = 21 half-points

/**
 * 生成SY004模板文档
 * @param {Object} structure - 编辑后的文档结构
 * @param {Object} documentInfo - 文档信息
 * @param {string} originalTemplatePath - 原始模板文件路径
 * @returns {Promise<string>} 生成的文档路径
 */
export async function generateSY004Document(structure, documentInfo, originalTemplatePath = null) {
  const children = [];

  // 1. 提取并添加模板前的头部信息
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

  // 2. 解析结构
  let basicInfoFields = null;
  let processSection = null;

  if (structure.sections) {
    structure.sections.forEach(section => {
      if (section.type === 'basic_info' && section.fields) {
        basicInfoFields = section.fields;
      }
      if (section.type === 'process') {
        processSection = section;
      }
    });
  }

  // 3. 构建4列表格（1545, 4320, 1200, 1215 DXA）
  const allRows = [];

  // 3.1 基本信息行（无论是否有值都输出，保持行结构）
  const bookNameField = basicInfoFields?.find(f => f.name === '绘本名称');
  const classHoursField = basicInfoFields?.find(f => f.name === '课时');
  allRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: '绘本名称',
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ],
              alignment: AlignmentType.CENTER
            })
          ],
          width: { size: 1545, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 30, left: 120, right: 120 }
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: bookNameField?.value || '',
                  font: defaultFont,
                  size: defaultSize
                })
              ],
              alignment: AlignmentType.LEFT
            })
          ],
          width: { size: 4320, type: WidthType.DXA },
          margins: { top: 60, bottom: 30, left: 120, right: 120 }
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: '课时',
                  font: defaultFont,
                  size: defaultSize,
                  bold: true
                })
              ],
              alignment: AlignmentType.CENTER
            })
          ],
          width: { size: 1200, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 30, left: 120, right: 120 }
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: classHoursField?.value || '',
                  font: defaultFont,
                  size: defaultSize
                })
              ],
              alignment: AlignmentType.LEFT
            })
          ],
          width: { size: 1215, type: WidthType.DXA },
          margins: { top: 60, bottom: 30, left: 120, right: 120 }
        })
      ]
    })
  );

    // 教学目标（编号列表）- 参考模版1的实现，优先使用_rawValue
    const objectivesField = basicInfoFields.find(f => f.name === '教学目标');
    if (objectivesField) {
      const objectiveParagraphs = [];
      
      if (objectivesField._rawValue) {
        // 如果有原始值，按行分割并创建段落（保持用户输入的格式）
        const lines = objectivesField._rawValue.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed) {
            objectiveParagraphs.push(
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
      } else if (objectivesField.items && objectivesField.items.length > 0) {
        // 如果有items数组，为每个item创建段落
        objectivesField.items.forEach(item => {
          const text = item.noNumber 
            ? (item.content || '')
            : `${item.number}. ${item.content || ''}`;
          if (text.trim()) {
            objectiveParagraphs.push(
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
      } else if (objectivesField.value) {
        // 兼容旧格式
        objectivesField.value.split('\n').forEach(line => {
          if (line.trim()) {
            objectiveParagraphs.push(
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
      } else {
        objectiveParagraphs.push(new Paragraph({ children: [new TextRun({ text: '', font: defaultFont, size: defaultSize })] }));
      }

      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '教学目标',
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 1545, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            }),
            new TableCell({
              children: objectiveParagraphs,
              columnSpan: 3,
              width: { size: 6735, type: WidthType.DXA },
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            })
          ]
        })
      );
    } else {
      // 保持行结构
      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '教学目标',
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 1545, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '', font: defaultFont, size: defaultSize })] })],
              columnSpan: 3,
              width: { size: 6735, type: WidthType.DXA },
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            })
          ]
        })
      );
    }

    // 教学准备（编号列表）- 参考模版1的实现，优先使用_rawValue
    const preparationField = basicInfoFields.find(f => f.name === '教学准备');
    if (preparationField) {
      const preparationParagraphs = [];
      
      if (preparationField._rawValue) {
        // 如果有原始值，按行分割并创建段落（保持用户输入的格式）
        const lines = preparationField._rawValue.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed) {
            preparationParagraphs.push(
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
      } else if (preparationField.items && preparationField.items.length > 0) {
        // 如果有items数组，为每个item创建段落
        preparationField.items.forEach(item => {
          const text = item.noNumber 
            ? (item.content || '')
            : `${item.number}. ${item.content || ''}`;
          if (text.trim()) {
            preparationParagraphs.push(
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
      } else if (preparationField.value) {
        // 兼容旧格式
        preparationField.value.split('\n').forEach(line => {
          if (line.trim()) {
            preparationParagraphs.push(
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
      } else {
        preparationParagraphs.push(new Paragraph({ children: [new TextRun({ text: '', font: defaultFont, size: defaultSize })] }));
      }

      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '教学准备',
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 1545, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            }),
            new TableCell({
              children: preparationParagraphs,
              columnSpan: 3,
              width: { size: 6735, type: WidthType.DXA },
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            })
          ]
        })
      );
    } else {
      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '教学准备',
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 1545, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '', font: defaultFont, size: defaultSize })] })],
              columnSpan: 3,
              width: { size: 6735, type: WidthType.DXA },
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            })
          ]
        })
      );
    }

    // 绘本简介（文本区域）
    const introductionField = basicInfoFields?.find(f => f.name === '绘本简介');
    if (introductionField) {
      const introductionParagraphs = [];
      
      if (introductionField.value) {
        introductionField.value.split('\n').forEach(line => {
          if (line.trim()) {
            introductionParagraphs.push(
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

      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '绘本简介',
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 1545, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            }),
            new TableCell({
              children: introductionParagraphs,
              columnSpan: 3,
              width: { size: 6735, type: WidthType.DXA },
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            })
          ]
        })
      );
    } else {
      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '绘本简介',
                      font: defaultFont,
                      size: defaultSize,
                      bold: true
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ],
              width: { size: 1545, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '', font: defaultFont, size: defaultSize })] })],
              columnSpan: 3,
              width: { size: 6735, type: WidthType.DXA },
              margins: { top: 60, bottom: 30, left: 120, right: 120 }
            })
          ]
        })
      );
    }

  // 3.2 教学过程
  if (processSection && processSection.sections) {
    let processRowIndex = 0; // 用于跟踪教学过程的行数
    
    processSection.sections.forEach((section, sectionIndex) => {
      // 导入环节
      if (section.type === 'import') {
        const importParagraphs = [];
        
        if (section.content) {
          section.content.split('\n').forEach(line => {
            if (line.trim()) {
              importParagraphs.push(
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

        // 第一列：包含"教学过程"和"导入环节"两个段落
        allRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '教学过程',
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '导入环节',
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  })
                ],
                width: { size: 1545, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              }),
              new TableCell({
                children: importParagraphs,
                columnSpan: 3,
                width: { size: 6735, type: WidthType.DXA },
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              })
            ]
          })
        );
        processRowIndex++;
      }
      // 精读环节
      else if (section.type === 'reading') {
        const readingParagraphs = [];
        
        if (section.items && section.items.length > 0) {
          section.items.forEach(item => {
            readingParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.title || '',
                    font: defaultFont,
                    size: defaultSize,
                    bold: true
                  })
                ]
              })
            );
            if (item.content) {
              item.content.split('\n').forEach(line => {
                if (line.trim()) {
                  readingParagraphs.push(
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
          });
        }

        // 第一列：包含"教学过程"和"精读环节"两个段落
        allRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '教学过程',
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '精读环节',
                        font: defaultFont,
                        size: defaultSize,
                        bold: true
                      })
                    ],
                    alignment: AlignmentType.CENTER
                  })
                ],
                width: { size: 1545, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              }),
              new TableCell({
                children: readingParagraphs,
                columnSpan: 3,
                width: { size: 6735, type: WidthType.DXA },
                margins: { top: 60, bottom: 30, left: 120, right: 120 }
              })
            ]
          })
        );
        processRowIndex++;
      }
      // 拓展环节
      else if (section.type === 'extension') {
        let isFirstExtensionRow = true;
        
        if (section.items && section.items.length > 0) {
          section.items.forEach((extensionItem, extIndex) => {
            const extensionParagraphs = [];
            
            extensionParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `拓展方式${extensionItem.number}: ${extensionItem.title || ''}`,
                    font: defaultFont,
                    size: defaultSize,
                    bold: true
                  })
                ]
              })
            );
            
            // 参考模版1的实现，优先使用_rawValue
            if (extensionItem._rawValue) {
              // 如果有原始值，按行分割并创建段落（保持用户输入的格式）
              const lines = extensionItem._rawValue.split('\n');
              lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed) {
                  extensionParagraphs.push(
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
            } else if (extensionItem.items && extensionItem.items.length > 0) {
              // 如果有items数组，为每个item创建段落
              extensionItem.items.forEach(item => {
                const text = item.noNumber 
                  ? (item.content || '')
                  : `${item.number}. ${item.content || ''}`;
                if (text.trim()) {
                  extensionParagraphs.push(
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

            // 第一列：第一行包含"拓展环节"，后续行垂直合并
            allRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: isFirstExtensionRow ? [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: '拓展环节',
                            font: defaultFont,
                            size: defaultSize,
                            bold: true
                          })
                        ],
                        alignment: AlignmentType.CENTER
                      })
                    ] : [],
                    verticalMerge: isFirstExtensionRow ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
                    width: { size: 1545, type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 30, left: 120, right: 120 }
                  }),
                  new TableCell({
                    children: extensionParagraphs,
                    columnSpan: 3,
                    width: { size: 6735, type: WidthType.DXA },
                    margins: { top: 60, bottom: 30, left: 120, right: 120 }
                  })
                ]
              })
            );
            isFirstExtensionRow = false;
          });
        }
        processRowIndex++;
      }
    });
  }
  
  // 注意：模版4 绘本简介后面没有"阅读测评"，只有"教学过程"
  // 如果后续需要支持"阅读测评"，可以在这里添加

  // 4. 创建表格
  if (allRows.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: allRows,
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

  // 5. 提取"示例图片"后的内容（如果存在）
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

  // 6. 创建文档
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

/**
 * 从原始模板中提取文档头部信息（如文档编号、作者）
 */
async function extractHeaderInfo(templatePath) {
  let documentNumber = '';
  let author = '';

  try {
    const zip = new AdmZip(templatePath);
    const documentXml = zip.readAsText('word/document.xml');
    const lines = documentXml.split('\n');

    // 查找第一个表格之前的内容
    let inHeader = true;
    for (const line of lines) {
      if (line.includes('<w:tbl>')) {
        inHeader = false;
        break;
      }
      if (inHeader && line.includes('<w:p>')) {
        const textMatch = line.match(/<w:t>(.*?)<\/w:t>/g);
        if (textMatch) {
          const textContent = textMatch.map(m => m.replace(/<\/?w:t>/g, '')).join('');
          if (textContent.trim()) {
            if (textContent.includes('SY004') || textContent.match(/[A-Z]{2}\d{3}/)) {
              documentNumber = textContent.trim();
            } else if (textContent.includes('作者')) {
              author = textContent.trim();
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('提取模板头部信息时出错:', error.message);
  }
  return { documentNumber, author };
}

/**
 * 提取"示例图片"后的内容
 */
async function extractExampleImageContent(templatePath) {
  const content = [];

  try {
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
      return content;
    }

    // 提取"示例图片"后的文本内容
    const remainingLines = lines.slice(exampleImageIndex);
    if (remainingLines.length > 1) {
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
  } catch (error) {
    console.warn('提取示例图片内容时出错:', error.message);
  }

  return content;
}

