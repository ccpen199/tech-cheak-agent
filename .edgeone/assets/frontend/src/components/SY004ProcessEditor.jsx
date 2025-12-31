import React from 'react';

/**
 * SY004 模板专用：教学过程编辑区域
 * 包含：导入环节、精读环节、拓展环节
 */
export default function SY004ProcessEditor({
  section,
  sectionIndex,
  editableStructure,
  setEditableStructure,
  result,
  validateFormatRealTime,
}) {
  if (!section?.sections) return null;

  const updateProcessSection = (procIndex, updater) => {
    const newStructure = JSON.parse(JSON.stringify(editableStructure));
    const processSection = newStructure.sections[sectionIndex];
    if (processSection.sections && processSection.sections[procIndex]) {
      updater(processSection.sections[procIndex]);
      setEditableStructure(newStructure);
      if (result?.templateFormatResult?.templateId) {
        validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
      }
    }
  };

  // 渲染带序号列表的编辑器（用于拓展环节的子项）
  const renderNumberedListEditor = (
    procIndex,
    extIndex,
    extensionItems,
    placeholder
  ) => {
    const dataAttrKey = 'data-extension-items-index';
    const dataAttrValue = `${sectionIndex}-${procIndex}-${extIndex}`;

    // 获取当前拓展方式的 items 数组
    const currentExtension = section.sections[procIndex]?.items?.[extIndex];
    const itemsArray = currentExtension?.items || extensionItems || [];
    const rawValue = currentExtension?._rawValue;

    return (
      <div className="list-item-editor">
        <button
          type="button"
          className="add-number-button"
          onClick={() => {
            const textarea = document.querySelector(
              `textarea[${dataAttrKey}="${dataAttrValue}"]`
            );
            if (!textarea) return;

            const currentValue = textarea.value || '';
            const lines = currentValue.split('\n');

            let maxNumber = 0;
            lines.forEach((line) => {
              const match = line.match(/^(\d+)\.\s*/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (!Number.isNaN(num) && num > maxNumber) {
                  maxNumber = num;
                }
              }
            });

            const nextNumber = maxNumber + 1;
            const newLine = currentValue ? `\n${nextNumber}. ` : `${nextNumber}. `;
            const newValue = currentValue + newLine;

            textarea.value = newValue;
            textarea.focus();
            const newPosition = newValue.length;
            textarea.setSelectionRange(newPosition, newPosition);

            const event = new Event('input', { bubbles: true });
            textarea.dispatchEvent(event);
          }}
          title="添加新序号行"
        >
          +
        </button>
        <textarea
          {...{ [dataAttrKey]: dataAttrValue }}
          value={
            rawValue !== undefined
              ? rawValue
              : itemsArray && itemsArray.length > 0
              ? itemsArray
                  .map((item) => {
                    if (item.noNumber) {
                      return item.content || '';
                    }
                    return `${item.number}. ${item.content || ''}`;
                  })
                  .join('\n')
              : ''
          }
          onChange={(e) => {
            const inputValue = e.target.value;
            const lines = inputValue.split('\n');

            const parsedItems = [];
            lines.forEach((line, index) => {
              if (!line.trim()) {
                return;
              }
              const match = line.match(/^(\d+)\.\s*(.*)/);
              if (match) {
                const num = match[1];
                const content = match[2].trim();
                if (!content) {
                  return;
                }
                parsedItems.push({
                  number: num,
                  content: content,
                  editable: true,
                });
              } else {
                parsedItems.push({
                  number: String(index + 1),
                  content: line.trim(),
                  editable: true,
                  noNumber: true,
                });
              }
            });

            updateProcessSection(procIndex, (procSection) => {
              if (!procSection.items) {
                procSection.items = [];
              }
              if (!procSection.items[extIndex]) {
                procSection.items[extIndex] = {
                  number: String(extIndex + 1),
                  title: '',
                  items: [],
                };
              }
              procSection.items[extIndex].items =
                parsedItems.length > 0
                  ? parsedItems
                  : [{ number: '1', content: '', editable: true }];
              procSection.items[extIndex]._rawValue = inputValue;
            });
          }}
          onKeyDown={(e) => {
            // 允许 Enter 键正常换行
            if (e.key === 'Enter' && !e.shiftKey) {
              // Enter 键正常换行，不做特殊处理
              return;
            }
          }}
          className="list-item-textarea"
          rows="6"
          wrap="soft"
          placeholder={placeholder}
        />
      </div>
    );
  };

  return (
    <div className="process-editor">
      {section.sections.map((procSection, procIndex) => (
        <div key={procIndex} className="process-section-block">
          <h4 className="process-section-title">{procSection.title}</h4>

          {/* 导入环节：纯文本内容（可编辑） */}
          {procSection.type === 'import' && (
            <div className="process-import-content">
              <textarea
                className="structure-textarea"
                value={procSection.content || ''}
                onChange={(e) =>
                  updateProcessSection(procIndex, (section) => {
                    section.content = e.target.value;
                  })
                }
                rows={4}
                placeholder="请输入导入环节内容..."
              />
            </div>
          )}

          {/* 精读环节：若干小项（观察封面 / 前环衬页 / 正文精读Px...） */}
          {procSection.type === 'reading' && (
            <div className="process-reading-list">
              {Array.isArray(procSection.items) && procSection.items.length > 0 ? (
                procSection.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="process-reading-item">
                    <div className="process-reading-item-header">
                      <input
                        type="text"
                        className="process-reading-item-title-input"
                        value={item.title || ''}
                        onChange={(e) =>
                          updateProcessSection(procIndex, (section) => {
                            if (!section.items) {
                              section.items = [];
                            }
                            if (!section.items[itemIndex]) {
                              section.items[itemIndex] = { title: '', content: '' };
                            }
                            section.items[itemIndex].title = e.target.value;
                          })
                        }
                        placeholder="例如：1.观察封面"
                      />
                      {procSection.items.length > 1 && (
                        <button
                          className="delete-segment-button"
                          onClick={() =>
                            updateProcessSection(procIndex, (section) => {
                              if (section.items && section.items.length > 1) {
                                section.items.splice(itemIndex, 1);
                              }
                            })
                          }
                          title="删除此项"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <textarea
                      className="structure-textarea"
                      value={item.content || ''}
                      onChange={(e) =>
                        updateProcessSection(procIndex, (section) => {
                          if (!section.items) {
                            section.items = [];
                          }
                          if (!section.items[itemIndex]) {
                            section.items[itemIndex] = { title: '', content: '' };
                          }
                          section.items[itemIndex].content = e.target.value;
                        })
                      }
                      rows={3}
                      placeholder="请输入此项内容..."
                    />
                  </div>
                ))
              ) : (
                <div className="no-items-message">暂无精读环节内容</div>
              )}
              <button
                className="add-segment-button"
                onClick={() =>
                  updateProcessSection(procIndex, (section) => {
                    if (!section.items) {
                      section.items = [];
                    }
                    section.items.push({
                      title: '',
                      content: '',
                      editable: true,
                    });
                  })
                }
              >
                + 添加精读项
              </button>
            </div>
          )}

          {/* 拓展环节：拓展方式1/2，每个方式下有编号列表 */}
          {procSection.type === 'extension' && (
            <div className="process-extension-list">
              {Array.isArray(procSection.items) && procSection.items.length > 0 ? (
                procSection.items.map((ext, extIndex) => (
                  <div key={extIndex} className="process-extension-item">
                    <div className="process-extension-header">
                      <div className="process-extension-title-row">
                        <span className="process-extension-label">
                          拓展方式{ext.number || extIndex + 1}:
                        </span>
                        <input
                          type="text"
                          className="process-extension-title-input"
                          value={ext.title || ''}
                          onChange={(e) =>
                            updateProcessSection(procIndex, (section) => {
                              if (!section.items) {
                                section.items = [];
                              }
                              if (!section.items[extIndex]) {
                                section.items[extIndex] = {
                                  number: String(extIndex + 1),
                                  title: '',
                                  items: [],
                                };
                              }
                              section.items[extIndex].title = e.target.value;
                            })
                          }
                          placeholder="请输入拓展方式标题..."
                        />
                        {procSection.items.length > 1 && (
                          <button
                            className="delete-segment-button"
                            onClick={() =>
                              updateProcessSection(procIndex, (section) => {
                                if (section.items && section.items.length > 1) {
                                  section.items.splice(extIndex, 1);
                                }
                              })
                            }
                            title="删除此拓展方式"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    {/* 拓展方式下的编号列表（可编辑，带+按钮） */}
                    <div className="process-extension-items-editor">
                      {renderNumberedListEditor(
                        procIndex,
                        extIndex,
                        ext.items || [],
                        '请输入拓展方式内容（支持多行，按Enter换行）...'
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-items-message">暂无拓展环节内容</div>
              )}
                        <button
                          className="add-segment-button"
                          onClick={() =>
                            updateProcessSection(procIndex, (section) => {
                              if (!section.items) {
                                section.items = [];
                              }
                              const nextNumber = section.items.length + 1;
                              // 自动填充默认序号：1. 2.
                              const defaultItems = [
                                { number: '1', content: '', editable: true },
                                { number: '2', content: '', editable: true }
                              ];
                              section.items.push({
                                number: String(nextNumber),
                                title: '',
                                items: defaultItems,
                                _rawValue: '1. \n2. ',
                                editable: true,
                              });
                            })
                          }
                        >
                          + 添加拓展方式
                        </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

