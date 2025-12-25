/**
 * SY002和SY005模板专用：教学步骤编辑区域
 * 结构：每个步骤包含多个游戏，每个游戏有要点（￮标记）和指导语
 */

import React from 'react';

export default function SY002SY005TeachingStepsEditor({
  section,
  sectionIndex,
  editableStructure,
  setEditableStructure,
  result,
  validateFormatRealTime,
}) {
  if (!section?.items) return null;

  const updateStep = (stepIndex, updater) => {
    const newStructure = JSON.parse(JSON.stringify(editableStructure));
    const stepSection = newStructure.sections[sectionIndex];
    if (stepSection.items && stepSection.items[stepIndex]) {
      updater(stepSection.items[stepIndex]);
      setEditableStructure(newStructure);
      if (result?.templateFormatResult?.templateId) {
        validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
      }
    }
  };

  const updateGame = (stepIndex, gameIndex, updater) => {
    const newStructure = JSON.parse(JSON.stringify(editableStructure));
    const step = newStructure.sections[sectionIndex].items[stepIndex];
    if (step.games && step.games[gameIndex]) {
      updater(step.games[gameIndex]);
      setEditableStructure(newStructure);
      if (result?.templateFormatResult?.templateId) {
        validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
      }
    }
  };

  return (
    <div className="teaching-steps-editor">
      {section.items.map((step, stepIndex) => (
        <div key={stepIndex} className="teaching-step-block">
          <div className="step-header">
            <input
              type="text"
              className="step-title-input"
              value={`${step.number}. ${step.title || ''}`}
              onChange={(e) => {
                const match = e.target.value.match(/^(\d+)\.\s*(.*)/);
                if (match) {
                  updateStep(stepIndex, (s) => {
                    s.number = match[1];
                    s.title = match[2].trim();
                  });
                }
              }}
              placeholder="例如：1. 热身+引入"
            />
            {section.items.length > 1 && (
              <button
                className="delete-segment-button"
                onClick={() => {
                  const newStructure = JSON.parse(JSON.stringify(editableStructure));
                  const items = newStructure.sections[sectionIndex].items;
                  if (items.length > 1) {
                    items.splice(stepIndex, 1);
                    // 重新编号
                    items.forEach((s, idx) => {
                      s.number = String(idx + 1);
                    });
                    setEditableStructure(newStructure);
                    if (result?.templateFormatResult?.templateId) {
                      validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                    }
                  }
                }}
                title="删除此步骤"
              >
                ✕
              </button>
            )}
          </div>

          {/* 游戏列表 */}
          <div className="games-list">
            {step.games && step.games.length > 0 ? (
              step.games.map((game, gameIndex) => {
                // 使用组合key确保唯一性
                const gameKey = `step-${stepIndex}-game-${gameIndex}`;
                // 判断是否是结束整理子项
                const isEndingItem = game.isEndingItem || /^(引导整理|课程总结)$/.test(game.title);
                // 判断是否是结束整理步骤
                const isEndingStep = /结束整理/.test(step.title);
                // 根据类型显示不同的标题
                const gameTitleValue = isEndingItem 
                  ? `${game.title}：`
                  : `游戏${game.number || gameIndex + 1}：${game.title || ''}`;
                
                return (
                <div key={gameKey} className="game-block" data-step-index={stepIndex} data-game-index={gameIndex}>
                  <div className="game-header">
                    <input
                      type="text"
                      className="game-title-input"
                      data-step-index={stepIndex}
                      data-game-index={gameIndex}
                      value={gameTitleValue}
                      onChange={(e) => {
                        const stepIdx = parseInt(e.target.dataset.stepIndex);
                        const gameIdx = parseInt(e.target.dataset.gameIndex);
                        const value = e.target.value;
                        
                        if (isEndingItem) {
                          // 结束整理子项：匹配"引导整理："或"课程总结："
                          const match = value.match(/^(引导整理|课程总结)[：:]?/);
                          if (match) {
                            updateGame(stepIdx, gameIdx, (g) => {
                              g.title = match[1];
                              g.number = match[1] === '引导整理' ? 'a' : 'b';
                              g.isEndingItem = true;
                            });
                          }
                        } else {
                          // 普通游戏：匹配"游戏1：xxx"
                          const match = value.match(/游戏(\d+)[：:]\s*(.*)/);
                          if (match) {
                            updateGame(stepIdx, gameIdx, (g) => {
                              g.number = match[1];
                              g.title = match[2].trim();
                              g.isEndingItem = false;
                            });
                          }
                        }
                      }}
                      placeholder={isEndingItem ? "例如：引导整理：" : "例如：游戏1：xxx"}
                    />
                    {step.games.length > 1 && (
                      <button
                        className="delete-segment-button"
                        data-step-index={stepIndex}
                        data-game-index={gameIndex}
                        onClick={(e) => {
                          const stepIdx = parseInt(e.currentTarget.dataset.stepIndex);
                          const gameIdx = parseInt(e.currentTarget.dataset.gameIndex);
                          updateStep(stepIdx, (s) => {
                            if (s.games && s.games.length > 1) {
                              s.games.splice(gameIdx, 1);
                            }
                          });
                        }}
                        title="删除此游戏"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* 游戏要点（包含指导语作为最后一行） */}
                  {/* 结束整理子项不显示要点，只显示指导语 */}
                  {!isEndingItem && (
                  <div className="game-points">
                    <div className="game-points-header">
                      <label className="game-points-label">要点：</label>
                      <button
                        type="button"
                        className="add-point-button"
                        data-step-index={stepIndex}
                        data-game-index={gameIndex}
                        onClick={(e) => {
                          const stepIdx = parseInt(e.currentTarget.dataset.stepIndex);
                          const gameIdx = parseInt(e.currentTarget.dataset.gameIndex);
                          
                          // 获取textarea元素
                          const textarea = document.querySelector(`.game-points-textarea[data-step-index="${stepIdx}"][data-game-index="${gameIdx}"]`);
                          if (!textarea) return;
                          
                          // 获取当前光标位置
                          const cursorPos = textarea.selectionStart;
                          const currentValue = textarea.value || '';
                          const lines = currentValue.split('\n');
                          
                          // 找到光标所在的行
                          let currentLineIndex = 0;
                          let charCount = 0;
                          for (let i = 0; i < lines.length; i++) {
                            charCount += lines[i].length + 1; // +1 for newline
                            if (charCount > cursorPos) {
                              currentLineIndex = i;
                              break;
                            }
                            if (i === lines.length - 1) {
                              currentLineIndex = i;
                            }
                          }
                          
                          // 在下一行插入新要点
                          const insertLineIndex = currentLineIndex + 1;
                          const newPoint = {
                            content: '',
                            prefix: '￮', // 使用￮符号
                            editable: true
                          };
                          
                          // 获取当前数据结构
                          const currentStep = editableStructure.sections[sectionIndex].items[stepIdx];
                          const currentGame = currentStep.games && currentStep.games[gameIdx];
                          const currentPoints = currentGame?.points || [];
                          const currentGuidance = currentGame?.guidance || '';
                          
                          // 判断插入位置：如果下一行是指导语，则插入在指导语之前
                          const nextLine = lines[insertLineIndex] || '';
                          const isNextLineGuidance = /^指导语[：:]/.test(nextLine.trim());
                          
                          // 计算在points数组中的插入位置
                          // 如果下一行是指导语，插入在points数组末尾
                          // 否则，需要找到对应的points数组位置
                          let insertPointIndex = currentPoints.length;
                          
                          if (!isNextLineGuidance && insertLineIndex < lines.length) {
                            // 计算指导语之前的要点数量
                            let pointCount = 0;
                            for (let i = 0; i < insertLineIndex; i++) {
                              const line = lines[i].trim();
                              if (line && !/^指导语[：:]/.test(line)) {
                                // 检查是否是要点行（有符号前缀）
                                const hasPrefix = /^[￮•·\-—○●▪▫→\d\.。、]/.test(line);
                                if (hasPrefix) {
                                  pointCount++;
                                }
                              }
                            }
                            insertPointIndex = pointCount;
                          }
                          
                          // 更新数据结构
                          updateGame(stepIdx, gameIdx, (g) => {
                            if (!g.points) g.points = [];
                            g.points.splice(insertPointIndex, 0, newPoint);
                          });
                          
                          // 等待React更新后设置光标位置
                          setTimeout(() => {
                            const updatedTextarea = document.querySelector(`.game-points-textarea[data-step-index="${stepIdx}"][data-game-index="${gameIdx}"]`);
                            if (updatedTextarea) {
                              updatedTextarea.focus();
                              // 计算新插入行的光标位置
                              const updatedValue = updatedTextarea.value || '';
                              const updatedLines = updatedValue.split('\n');
                              
                              // 找到新插入的行（应该是insertLineIndex位置）
                              let targetLineIndex = insertLineIndex;
                              if (targetLineIndex >= updatedLines.length) {
                                targetLineIndex = updatedLines.length - 1;
                              }
                              
                              // 计算光标位置：在新插入行的符号后面
                              const beforeLines = updatedLines.slice(0, targetLineIndex);
                              const beforeText = beforeLines.join('\n');
                              const cursorPos = beforeText.length + (beforeText ? 1 : 0) + newPoint.prefix.length + 1;
                              updatedTextarea.setSelectionRange(cursorPos, cursorPos);
                            }
                          }, 100);
                        }}
                        title="添加要点（使用￮符号，在指导语之前）"
                      >
                        + 添加要点
                      </button>
                    </div>
                    <textarea
                      className="game-points-textarea"
                      data-step-index={stepIndex}
                      data-game-index={gameIndex}
                      value={
                        (() => {
                          const points = game.points || [];
                          const guidance = game.guidance || '';
                          const pointLines = points.map((p) => {
                            const prefix = p.prefix || '￮';
                            return `${prefix} ${p.content || ''}`;
                          });
                          // 如果有指导语，添加在最后
                          if (guidance.trim()) {
                            pointLines.push(`指导语：${guidance}`);
                          }
                          return pointLines.join('\n');
                        })()
                      }
                        onChange={(e) => {
                        const stepIdx = parseInt(e.target.dataset.stepIndex);
                        const gameIdx = parseInt(e.target.dataset.gameIndex);
                        const inputValue = e.target.value;
                        const lines = inputValue.split('\n');
                        const points = [];
                        let guidance = '';
                        let guidanceFound = false;
                        let guidanceLineIndex = -1;
                        
                        // 先获取当前的指导语，作为默认值（防止误删）
                        const currentStep = editableStructure.sections[sectionIndex].items[stepIdx];
                        const currentGame = currentStep.games && currentStep.games[gameIdx];
                        const currentGuidance = currentGame?.guidance || '';
                        
                        // 先找到指导语行的位置（应该始终在最后）
                        for (let i = lines.length - 1; i >= 0; i--) {
                          const trimmed = lines[i].trim();
                          if (/^指导语[：:]\s*(.*)/.test(trimmed)) {
                            const match = trimmed.match(/^指导语[：:]\s*(.*)/);
                            guidance = match[1] || '';
                            guidanceFound = true;
                            guidanceLineIndex = i;
                            break;
                          }
                        }
                        
                        // 只处理指导语行之前的内容（确保指导语始终在最后）
                        const processLines = guidanceLineIndex >= 0 ? lines.slice(0, guidanceLineIndex) : lines;
                        
                        processLines.forEach((line, index) => {
                          const trimmed = line.trim();
                          
                          // 空行直接跳过（不保存）
                          if (!trimmed) {
                            return;
                          }
                          
                          // 检查是否包含"指导语:"（不应该出现在要点区域）
                          if (/指导语[：:]/.test(trimmed)) {
                            return; // 跳过
                          }
                          
                          let content = null;
                          let prefix = null;
                          
                          // 先匹配数字序号格式：1. 2. 3. 或 1。2。3。 或 1、2、3、
                          const numberedMatch = trimmed.match(/^(\d+)([\.。、])\s*(.*)/);
                          if (numberedMatch) {
                            const numContent = numberedMatch[3].trim();
                            // 如果只有序号没有内容，跳过这一行（用户删除了内容）
                            if (!numContent) {
                              return;
                            }
                            content = numContent;
                            prefix = numberedMatch[1] + numberedMatch[2];
                          } else {
                            // 匹配符号前缀
                            const symbolPrefixes = ['￮', '•', '·', '-', '—', '○', '●', '▪', '▫', '→'];
                            let matched = false;
                            for (const symPrefix of symbolPrefixes) {
                              if (trimmed.startsWith(symPrefix)) {
                                const symContent = trimmed.substring(symPrefix.length).trim();
                                // 如果只有符号没有内容，跳过这一行（用户删除了内容）
                                if (!symContent) {
                                  return;
                                }
                                content = symContent;
                                prefix = symPrefix;
                                matched = true;
                                break;
                              }
                            }
                            // 如果没有匹配到任何前缀，检查是否是以数字开头的序号（可能没有分隔符）
                            if (!matched) {
                              const simpleNumberMatch = trimmed.match(/^(\d+)\s+(.*)/);
                              if (simpleNumberMatch) {
                                const numContent = simpleNumberMatch[2].trim();
                                if (!numContent) {
                                  return;
                                }
                                content = numContent;
                                prefix = simpleNumberMatch[1] + '.';
                              }
                            }
                          }
                          
                          // 如果还是没有匹配到，说明用户删除了符号，但还有内容
                          // 这种情况下，保留内容并添加默认前缀
                          if (!content) {
                            // 如果整行都是空白或只有空格，跳过
                            if (!trimmed || trimmed.length === 0) {
                              return;
                            }
                            content = trimmed;
                            prefix = '￮';
                          }
                          
                          // 确保内容不包含"指导语:"
                          if (content && !/指导语[：:]/.test(content)) {
                            points.push({ 
                              content, 
                              prefix: prefix || '￮',
                              editable: true 
                            });
                          }
                        });
                        
                        // 如果没有找到指导语行，但之前有指导语，保留原来的指导语（防止误删）
                        if (!guidanceFound && currentGuidance) {
                          guidance = currentGuidance;
                        }
                        
                        updateGame(stepIdx, gameIdx, (g) => {
                          g.points = points.length > 0 ? points : [];
                          g.guidance = guidance || '';
                        });
                      }}
                      rows="6"
                      placeholder='请输入要点（每行一个，支持：￮、•、1.、-、○ 等符号开头，默认使用￮），最后一行输入"指导语：xxx"作为指导语...'
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          // Allow normal Enter for new lines
                        }
                      }}
                    />
                  </div>
                  )}
                  
                  {/* 结束整理子项只显示指导语 */}
                  {isEndingItem && (
                  <div className="game-guidance">
                    <div className="game-guidance-header">
                      <label className="game-guidance-label">指导语：</label>
                    </div>
                    <textarea
                      className="game-guidance-textarea"
                      data-step-index={stepIndex}
                      data-game-index={gameIndex}
                      value={game.guidance || ''}
                      onChange={(e) => {
                        const stepIdx = parseInt(e.target.dataset.stepIndex);
                        const gameIdx = parseInt(e.target.dataset.gameIndex);
                        updateGame(stepIdx, gameIdx, (g) => {
                          g.guidance = e.target.value;
                        });
                      }}
                      rows="3"
                      placeholder="请输入指导语..."
                    />
                  </div>
                  )}
                </div>
              );
              })
            ) : (
              <div className="no-items-message">暂无游戏内容</div>
            )}
            <button
              className="add-segment-button"
              onClick={() => {
                updateStep(stepIndex, (s) => {
                  if (!s.games) {
                    s.games = [];
                  }
                  const nextNumber = s.games.length + 1;
                  s.games.push({
                    number: String(nextNumber),
                    title: '',
                    points: [],
                    guidance: '',
                    editable: true,
                  });
                });
              }}
            >
              + 添加游戏
            </button>
          </div>
        </div>
      ))}
      <button
        className="add-segment-button"
        onClick={() => {
          const newStructure = JSON.parse(JSON.stringify(editableStructure));
          const items = newStructure.sections[sectionIndex].items;
          const nextNumber = items.length + 1;
          items.push({
            number: String(nextNumber),
            title: '',
            games: [],
            editable: true,
          });
          setEditableStructure(newStructure);
          if (result?.templateFormatResult?.templateId) {
            validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
          }
        }}
      >
        + 添加教学步骤
      </button>
    </div>
  );
}

