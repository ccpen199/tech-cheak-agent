import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import SY004BasicInfoEditor from './components/SY004BasicInfoEditor.jsx';
import SY004ProcessEditor from './components/SY004ProcessEditor.jsx';
import SY002SY005TeachingStepsEditor from './components/SY002SY005TeachingStepsEditor.jsx';

function App() {
  const [mode, setMode] = useState('select'); // 'select'、'upload' 或 'edit'
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); // 详细的加载状态
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [teachingEvaluation, setTeachingEvaluation] = useState('');
  const [modificationComments, setModificationComments] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [formatIssuesExpanded, setFormatIssuesExpanded] = useState(false);
  const [editableStructure, setEditableStructure] = useState(null);
  const [realTimeFormatErrors, setRealTimeFormatErrors] = useState(null);

  // 当前是否为 SY004 模板（绘本剧）
  const isSY004Template =
    (selectedTemplate?.id && selectedTemplate.id.startsWith('SY004')) ||
    (selectedTemplate?.name && selectedTemplate.name.startsWith('SY004')) ||
    (result?.templateFormatResult?.templateId === 'SY004');

  // 当前是否为 SY002 或 SY005 模板（体适能课/食育课）
  const isSY002SY005Template =
    (selectedTemplate?.id && (selectedTemplate.id.startsWith('SY002') || selectedTemplate.id.startsWith('SY005'))) ||
    (selectedTemplate?.name && (selectedTemplate.name.startsWith('SY002') || selectedTemplate.name.startsWith('SY005'))) ||
    (result?.templateFormatResult?.templateId === 'SY002' || result?.templateFormatResult?.templateId === 'SY005');

  // 加载模板列表
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await axios.get('/api/templates');
      setTemplates(response.data.templates || []);
    } catch (err) {
      console.error('加载模板列表错误:', err);
      setError('加载模板列表失败');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = async (template) => {
    try {
      setUploading(true);
      setError(null);
      setResult(null);
      setEditableStructure(null);
      setRealTimeFormatErrors(null);
      setUploadStatus('正在导入模板...');
      
      // 直接导入模板并自动处理
      const response = await axios.post('/api/import-template', {
        templateId: template.id,
        filename: template.filename
      }, {
        timeout: 180000, // 增加到3分钟，因为智能体可能需要较长时间
        onUploadProgress: (progressEvent) => {
          // 可以在这里更新进度，但导入模板是服务器端处理，所以这里主要是等待
          if (progressEvent.loaded && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadStatus(`正在上传模板... ${percent}%`);
          }
        }
      });
      
      // 模拟进度更新，让用户知道系统在工作
      setUploadStatus('正在解析文档结构...');
      await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟，让状态更新可见
      
      setUploadStatus('正在调用智能体进行分析（可能需要30-60秒）...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setUploadStatus('正在加载结果...');
      setResult(response.data);
      setSelectedTemplate(template);
      setMode('edit'); // 进入编辑模式
      
      // 设置可编辑结构
      if (response.data.documentStructure) {
        setEditableStructure(response.data.documentStructure);
        // 初始格式验证
        if (response.data.templateFormatResult?.templateId) {
          validateFormatRealTime(response.data.documentStructure, response.data.templateFormatResult.templateId);
        }
      }
      
      setUploadStatus('');
      
      // 如果有智能体评价结果，自动填充
      if (response.data.teachingEvaluation) {
        const evaluation = response.data.teachingEvaluation;
        let evalText = '';
        if (evaluation.evaluation) {
          evalText += `【总体评价】\n${evaluation.evaluation}\n\n`;
        }
        if (evaluation.strengths && evaluation.strengths.length > 0) {
          evalText += `【优点】\n${evaluation.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        }
        if (evaluation.improvements && evaluation.improvements.length > 0) {
          evalText += `【改进建议】\n${evaluation.improvements.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        }
        if (evaluation.overall_score) {
          evalText += `【综合评分】${evaluation.overall_score}/10分`;
        }
        setTeachingEvaluation(evalText.trim());
      }
      
      // 如果有智能体修改建议，自动填充
      if (response.data.modificationSuggestion) {
        const suggestion = response.data.modificationSuggestion;
        let suggestionText = '';
        if (suggestion.summary) {
          suggestionText += `【总体建议】\n${suggestion.summary}\n\n`;
        }
        if (suggestion.suggestions && suggestion.suggestions.length > 0) {
          suggestionText += `【具体修改建议】\n`;
          suggestion.suggestions.forEach((s, i) => {
            suggestionText += `\n${i + 1}. 【${s.section}】\n`;
            if (s.issue) {
              suggestionText += `   问题：${s.issue}\n`;
            }
            if (s.suggestion) {
              suggestionText += `   建议：${s.suggestion}\n`;
            }
            if (s.priority) {
              suggestionText += `   优先级：${s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}\n`;
            }
          });
        }
        setModificationComments(suggestionText.trim());
      }
      
      // 如果有飞书记录但没有智能体结果，清空输入框
      if (response.data.larkRecord?.recordId && !response.data.teachingEvaluation && !response.data.modificationSuggestion) {
        setTeachingEvaluation('');
        setModificationComments('');
      }
    } catch (err) {
      console.error('导入模板错误:', err);
      setError(err.response?.data?.error || err.message || '导入模板失败，请重试');
      setUploadStatus('');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // 检查文件类型
      const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (fileExt === '.doc') {
        setError(
          '不支持 .doc 格式文件。请将文件转换为 .docx 格式后再上传。\n\n' +
          '转换方法：\n' +
          '1. 用 Microsoft Word 打开 .doc 文件\n' +
          '2. 点击"文件" -> "另存为"\n' +
          '3. 选择文件类型为"Word 文档 (*.docx)"\n' +
          '4. 保存后重新上传'
        );
        setFile(null);
        return;
      }
      
      if (fileExt !== '.docx') {
        setError('只支持 .docx 格式的文件');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setEditableStructure(null);
      setRealTimeFormatErrors(null);
      
      // 自动上传和处理（不需要点击处理按钮）
      handleAutoUpload(selectedFile);
    }
  };

  const handleAutoUpload = async (fileToUpload) => {
    if (!fileToUpload) return;

    setUploading(true);
    setError(null);
    setResult(null);
      setUploadStatus('正在上传文件...');

    try {
      const formData = new FormData();
      formData.append('document', fileToUpload);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 180000, // 3分钟超时
        onUploadProgress: (progressEvent) => {
          if (progressEvent.loaded && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (percent < 100) {
              setUploadStatus(`正在上传文件... ${percent}%`);
            } else {
              setUploadStatus('正在处理文档...');
            }
          }
        }
      });
      
      // 模拟进度更新
      setUploadStatus('正在解析文档结构...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 检查是否是模板文件，如果是则提示智能体分析
      const isTemplateFile = fileToUpload.name.includes('SY001') || 
                             fileToUpload.name.includes('SY002') || 
                             fileToUpload.name.includes('SY003') || 
                             fileToUpload.name.includes('SY004') || 
                             fileToUpload.name.includes('SY005') ||
                             fileToUpload.name.includes('模板');
      
      if (isTemplateFile) {
        setUploadStatus('正在调用智能体进行分析（可能需要30-60秒）...');
      } else {
        setUploadStatus('正在加载结果...');
      }

      setResult(response.data);
      
      // 设置可编辑结构
      if (response.data.documentStructure) {
        setEditableStructure(response.data.documentStructure);
        // 初始格式验证
        validateFormatRealTime(response.data.documentStructure, response.data.templateFormatResult?.templateId);
      }
      
      // 如果有智能体评价结果，自动填充
      if (response.data.teachingEvaluation) {
        const evaluation = response.data.teachingEvaluation;
        let evalText = '';
        if (evaluation.evaluation) {
          evalText += `【总体评价】\n${evaluation.evaluation}\n\n`;
        }
        if (evaluation.strengths && evaluation.strengths.length > 0) {
          evalText += `【优点】\n${evaluation.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        }
        if (evaluation.improvements && evaluation.improvements.length > 0) {
          evalText += `【改进建议】\n${evaluation.improvements.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        }
        if (evaluation.overall_score) {
          evalText += `【综合评分】${evaluation.overall_score}/10分`;
        }
        setTeachingEvaluation(evalText.trim());
      }
      
      // 如果有智能体修改建议，自动填充
      if (response.data.modificationSuggestion) {
        const suggestion = response.data.modificationSuggestion;
        let suggestionText = '';
        if (suggestion.summary) {
          suggestionText += `【总体建议】\n${suggestion.summary}\n\n`;
        }
        if (suggestion.suggestions && suggestion.suggestions.length > 0) {
          suggestionText += `【具体修改建议】\n`;
          suggestion.suggestions.forEach((s, i) => {
            suggestionText += `\n${i + 1}. 【${s.section}】\n`;
            if (s.issue) {
              suggestionText += `   问题：${s.issue}\n`;
            }
            if (s.suggestion) {
              suggestionText += `   建议：${s.suggestion}\n`;
            }
            if (s.priority) {
              suggestionText += `   优先级：${s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}\n`;
            }
          });
        }
        setModificationComments(suggestionText.trim());
      }
      
      // 如果有飞书记录但没有智能体结果，清空输入框
      if (response.data.larkRecord?.recordId && !response.data.teachingEvaluation && !response.data.modificationSuggestion) {
        setTeachingEvaluation('');
        setModificationComments('');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || '上传失败，请重试');
      console.error('上传错误:', err);
    } finally {
      setUploading(false);
    }
  };
  
  // 实时验证格式
  const validateFormatRealTime = async (structure, templateId) => {
    if (!structure || !templateId) return;
    
    try {
      const response = await axios.post('/api/validate-format', {
        structure: structure,
        templateId: templateId
      });
      
      if (response.data.success && response.data.formatResult) {
        setRealTimeFormatErrors(response.data.formatResult);
      }
    } catch (error) {
      console.error('实时验证错误:', error);
    }
  };
  
  // 下载编辑后的文档
  const handleDownloadEdited = async () => {
    if (!editableStructure || !selectedTemplate) {
      setError('没有可下载的内容');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const response = await axios.post('/api/generate-document', {
        structure: editableStructure,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        documentInfo: result?.documentInfo,
        originalTemplateFilename: selectedTemplate.filename
      }, {
        responseType: 'blob',
        timeout: 120000
      });

      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名：模板名-时间戳.docx
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `${selectedTemplate.name}-${timestamp}.docx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert('✅ 文档已生成并开始下载！');
    } catch (err) {
      setError(err.response?.data?.error || err.message || '生成文档失败，请重试');
      console.error('生成文档错误:', err);
    } finally {
      setSyncing(false);
    }
  };
  
  // 处理结构编辑
  const handleStructureChange = (path, value) => {
    if (!editableStructure) return;
    
    const newStructure = JSON.parse(JSON.stringify(editableStructure));
    
    // 根据path更新值
    const keys = path.split('.');
    let current = newStructure;
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i].match(/^\d+$/)) {
        current = current[parseInt(keys[i])];
      } else {
        current = current[keys[i]];
      }
    }
    const lastKey = keys[keys.length - 1];
    if (lastKey.match(/^\d+$/)) {
      current[parseInt(lastKey)] = value;
    } else {
      current[lastKey] = value;
    }
    
    setEditableStructure(newStructure);
    
    // 实时验证
    if (result?.templateFormatResult?.templateId) {
      validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('请选择文件');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2分钟超时
      });

      setResult(response.data);
      // 如果有飞书记录，清空输入框，准备输入新的评价和意见
      if (response.data.larkRecord?.recordId) {
        setTeachingEvaluation('');
        setModificationComments('');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || '上传失败，请重试');
      console.error('上传错误:', err);
    } finally {
      setUploading(false);
    }
  };


  const handleSyncToLark = async () => {
    if (!result?.larkRecord?.recordId) {
      setError('没有可同步的飞书记录，请先上传文档');
      return;
    }

    if (!teachingEvaluation.trim() && !modificationComments.trim()) {
      setError('请至少填写教学评价或修改意见');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const response = await axios.post('/api/sync-review', {
        recordId: result.larkRecord.recordId,
        teachingEvaluation: teachingEvaluation.trim(),
        modificationComments: modificationComments.trim()
      });

      if (response.data.success) {
        setError(null);
        alert('✅ 同步成功！教学评价和修改意见已更新到飞书');
      } else {
        setError(response.data.error || '同步失败');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || '同步失败，请重试');
      console.error('同步错误:', err);
    } finally {
      setSyncing(false);
    }
  };

  // 渲染带序号列表的编辑器（操作方法、教师指导语）
  const renderNumberedListEditor = (label, containerClass, fieldName, fieldData, sectionIndex, segmentIndex, placeholder) => {
    const dataAttrKey = fieldName === 'method' ? 'data-method-index' : 'data-guidance-index';
    const dataAttrValue = `${sectionIndex}-${segmentIndex}`;
    
    return (
      <div className={containerClass}>
        <label>{label}:</label>
        <div className="list-item-editor">
          <button
            type="button"
            className="add-number-button"
            onClick={() => {
              // 获取当前textarea的值
              const textarea = document.querySelector(`textarea[${dataAttrKey}="${dataAttrValue}"]`);
              if (!textarea) return;
              
              const currentValue = textarea.value;
              const lines = currentValue.split('\n');
              
              // 从实际显示的文本中找出最大序号
              let maxNumber = 0;
              lines.forEach(line => {
                const match = line.match(/^(\d+)\.\s*/);
                if (match) {
                  const num = parseInt(match[1]);
                  if (num > maxNumber) {
                    maxNumber = num;
                  }
                }
              });
              
              const nextNumber = maxNumber + 1;
              
              // 在末尾添加新的一行（带序号）
              const newLine = currentValue ? `\n${nextNumber}. ` : `${nextNumber}. `;
              const newValue = currentValue + newLine;
              
              // 更新textarea的值
              textarea.value = newValue;
              textarea.focus();
              // 设置光标到末尾
              const newPosition = newValue.length;
              textarea.setSelectionRange(newPosition, newPosition);
              
              // 触发onChange事件
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
              // 优先使用原始值（包括空行），如果没有则从items重建
              fieldData?._rawValue !== undefined
                ? fieldData._rawValue
                : (fieldData?.items && fieldData.items.length > 0
                    ? fieldData.items.map(item => {
                        // 如果标记为无序号行，直接显示内容
                        if (item.noNumber) {
                          return item.content || '';
                        }
                        return `${item.number}. ${item.content || ''}`;
                      }).join('\n')
                    : '')
            }
            onChange={(e) => {
              const newStructure = JSON.parse(JSON.stringify(editableStructure));
              const inputValue = e.target.value; // 保留原始值，包括空行
              const lines = inputValue.split('\n');
              
              // 解析每行，提取序号和内容
              // 允许用户自由编辑，包括删除序号、添加二级标签等
              const items = [];
              
              lines.forEach((line, index) => {
                // 跳过空行（不在items中保存，但保留在显示中）
                if (!line.trim()) {
                  return;
                }
                
                const match = line.match(/^(\d+)\.\s*(.*)/);
                if (match) {
                  // 有序号的行，保留序号和内容
                  items.push({
                    number: match[1],
                    content: match[2].trim(),
                    editable: true
                  });
                } else {
                  // 没有序号的行，保留原样（允许用户添加二级标签等）
                  // 如果整行都没有序号，作为内容保存
                  items.push({
                    number: String(index + 1), // 临时序号，仅用于数据结构
                    content: line.trim(),
                    editable: true,
                    noNumber: true // 标记为无序号行
                  });
                }
              });
              
              if (!newStructure.sections[sectionIndex].items[segmentIndex][fieldName]) {
                newStructure.sections[sectionIndex].items[segmentIndex][fieldName] = {};
              }
              if (!newStructure.sections[sectionIndex].items[segmentIndex][fieldName].items) {
                newStructure.sections[sectionIndex].items[segmentIndex][fieldName].items = [];
              }
              // 如果所有行都被删除，保留一个空项
              newStructure.sections[sectionIndex].items[segmentIndex][fieldName].items = items.length > 0 ? items : [{ number: '1', content: '', editable: true }];
              
              // 保存原始输入值（包括空行）到临时字段，用于显示
              newStructure.sections[sectionIndex].items[segmentIndex][fieldName]._rawValue = inputValue;
              
              setEditableStructure(newStructure);
              if (result?.templateFormatResult?.templateId) {
                validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
              }
            }}
            className="list-item-textarea"
            rows="6"
            wrap="soft"
            placeholder={placeholder}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>教案评审系统</h1>
          <p>选择模板或直接上传Word文档，系统将自动检测错别字、检查格式并登记到飞书</p>
        </header>

        {/* 模式选择 */}
        {mode === 'select' && (
          <div className="template-section">
            <div className="mode-selector">
              <button 
                className={`mode-button ${mode === 'select' ? 'active' : ''}`}
                onClick={() => setMode('select')}
              >
                选择模板
              </button>
              <button 
                className={`mode-button ${mode === 'upload' ? 'active' : ''}`}
                onClick={() => setMode('upload')}
              >
                直接上传
              </button>
            </div>

            {loadingTemplates ? (
              <div className="loading">加载模板列表中...</div>
            ) : templates.length === 0 ? (
              <div className="error-message">未找到模板文件</div>
            ) : (
              <>
                {uploading && (
                  <div className="upload-status" style={{ marginBottom: '20px' }}>
                    <div className="upload-spinner">⏳</div>
                    <span>{uploadStatus || '正在处理中，请稍候...'}</span>
                    {(uploadStatus && uploadStatus.includes('智能体')) || (!uploadStatus && uploading) ? (
                      <div className="upload-hint">💡 智能体分析可能需要30-60秒，请耐心等待</div>
                    ) : null}
                  </div>
                )}
                <div className="templates-grid">
                  <h3>请选择一个模板：</h3>
                  <div className="templates-list">
                    {templates.map((template) => (
                      <div key={template.id} className="template-card">
                        <div className="template-info">
                          <h4>{template.name}</h4>
                          <p className="template-meta">
                            {(template.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <button
                          className="template-download-button"
                          onClick={() => handleTemplateSelect(template)}
                          disabled={uploading}
                        >
                          {uploading && selectedTemplate?.id === template.id ? (uploadStatus || '处理中...') : '选择并编辑'}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="template-hint">
                    <p>💡 提示：选择模板后将自动导入并进入编辑模式，可直接在线编辑</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 编辑模式 */}
        {mode === 'edit' && selectedTemplate && result && (
          <div className="edit-section">
            <div className="mode-selector">
              <button 
                className={`mode-button ${mode === 'select' ? 'active' : ''}`}
                onClick={() => {
                  setMode('select');
                  setSelectedTemplate(null);
                  setResult(null);
                  setEditableStructure(null);
                }}
              >
                选择模板
              </button>
              <button 
                className={`mode-button ${mode === 'upload' ? 'active' : ''}`}
                onClick={() => setMode('upload')}
              >
                直接上传
              </button>
            </div>

            <div className="selected-template-info">
              <p>📄 当前模板：<strong>{selectedTemplate.name}</strong></p>
              <p className="hint">可直接在线编辑，右侧实时显示格式验证结果</p>
            </div>
          </div>
        )}

        {/* 上传模式 */}
        {mode === 'upload' && (
          <div className="upload-section">
            <div className="mode-selector">
              <button 
                className={`mode-button ${mode === 'select' ? 'active' : ''}`}
                onClick={() => {
                  setMode('select');
                  setFile(null);
                  setResult(null);
                }}
              >
                选择模板
              </button>
              <button 
                className={`mode-button ${mode === 'upload' ? 'active' : ''}`}
                onClick={() => setMode('upload')}
              >
                直接上传
              </button>
            </div>

            {selectedTemplate && (
              <div className="selected-template-info">
                <p>📄 已选择模板：<strong>{selectedTemplate.name}</strong></p>
                <p className="hint">请编辑模板后上传，或选择其他文件</p>
              </div>
            )}

            <div className="upload-box">
              <input
                type="file"
                id="file-input"
                accept=".docx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-input" className="file-label">
                {file ? file.name : '点击选择文档 (.docx) - 将自动处理'}
              </label>
              
              {uploading && (
                <div className="upload-status">
                  <div className="upload-spinner">⏳</div>
                  <span>{uploadStatus || '正在自动处理中，请稍候...'}</span>
                  {uploadStatus && uploadStatus.includes('智能体') && (
                    <div className="upload-hint">💡 智能体分析可能需要30-60秒，请耐心等待</div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
        )}

        {(result || (mode === 'edit' && selectedTemplate)) && (
          <div className="result-section">
            <div className="result-layout">
              {/* 左侧：可编辑的模板结构和处理结果 */}
              <div className="result-content">
                {/* 显示可编辑的模板结构 */}
                {editableStructure && (
                  <div className="editable-structure">
                    <h2>
                      文档内容编辑
                      {selectedTemplate && (
                        <span className="template-badge">{selectedTemplate.name}</span>
                      )}
                      <button
                        onClick={handleDownloadEdited}
                        className="editor-download-button"
                        disabled={syncing}
                      >
                        {syncing ? '生成中...' : '📥 下载编辑后的文档'}
                      </button>
                    </h2>
                    {editableStructure.sections?.map((section, sectionIndex) => (
                      <div key={sectionIndex} className="structure-section">
                        {section.title && <h3>{section.title}</h3>}
                        
                        {/* 基本信息区域 */}
                        {section.type === 'basic_info' && section.fields && (
                          isSY004Template ? (
                            <SY004BasicInfoEditor
                              section={section}
                              sectionIndex={sectionIndex}
                              editableStructure={editableStructure}
                              setEditableStructure={setEditableStructure}
                              result={result}
                              validateFormatRealTime={validateFormatRealTime}
                            />
                          ) : (
                            <div className="basic-info-editor">
                              {section.fields.map((field, fieldIndex) => {
                                // SY002和SY005的课程目标和课程材料使用编号列表编辑器
                                if ((isSY002SY005Template && (field.name === '课程目标' || field.name === '课程材料')) && field.items) {
                                  return (
                                    <div key={fieldIndex} className="basic-info-row">
                                      <label className="basic-info-label">{field.name}:</label>
                                      <div className="basic-info-input-wrapper">
                                        <div className="list-item-editor">
                                          <button
                                            type="button"
                                            className="add-number-button"
                                            onClick={() => {
                                              const textarea = document.querySelector(
                                                `textarea[data-basic-number-index="${sectionIndex}-${fieldIndex}-${field.name}"]`
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
                                            data-basic-number-index={`${sectionIndex}-${fieldIndex}-${field.name}`}
                                            value={
                                              field?._rawValue !== undefined
                                                ? field._rawValue
                                                : field?.items && field.items.length > 0
                                                ? field.items
                                                    .map((item) => {
                                                      if (item.noNumber) {
                                                        return item.content || '';
                                                      }
                                                      return `${item.number}. ${item.content || ''}`;
                                                    })
                                                    .join('\n')
                                                : field.value || ''
                                            }
                                            onChange={(e) => {
                                              const inputValue = e.target.value;
                                              const lines = inputValue.split('\n');

                                              const items = [];
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
                                                  items.push({
                                                    number: num,
                                                    content,
                                                    editable: true,
                                                  });
                                                } else {
                                                  items.push({
                                                    number: String(index + 1),
                                                    content: line.trim(),
                                                    editable: true,
                                                    noNumber: true,
                                                  });
                                                }
                                              });

                                              const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                              const targetField =
                                                newStructure.sections[sectionIndex].fields[fieldIndex];

                                              targetField.items =
                                                items.length > 0 ? items : [{ number: '1', content: '', editable: true }];
                                              targetField._rawValue = inputValue;
                                              targetField.value = inputValue;

                                              setEditableStructure(newStructure);
                                              if (result?.templateFormatResult?.templateId) {
                                                validateFormatRealTime(
                                                  newStructure,
                                                  result.templateFormatResult.templateId
                                                );
                                              }
                                            }}
                                            className="list-item-textarea"
                                            rows="6"
                                            wrap="soft"
                                            placeholder={`请输入${field.name}（支持多行，按Enter换行）...`}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // 普通字段
                                return (
                                <div key={fieldIndex} className="basic-info-row">
                                  <label className="basic-info-label">{field.name}:</label>
                                  <div className="basic-info-input-wrapper">
                                    <textarea
                                      value={field.value || ''}
                                      onChange={(e) => {
                                        const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                        newStructure.sections[sectionIndex].fields[fieldIndex].value = e.target.value;
                                        setEditableStructure(newStructure);
                                        if (result?.templateFormatResult?.templateId) {
                                          validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                                        }
                                      }}
                                      className="review-textarea"
                                      rows="2"
                                      placeholder={`请输入${field.name}...`}
                                    />
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )
                        )}
                        
                        {/* SY004 教学过程区域（导入环节 / 精读环节 / 拓展环节）- 可编辑 */}
                        {section.type === 'process' && section.sections && isSY004Template && (
                          <SY004ProcessEditor
                            section={section}
                            sectionIndex={sectionIndex}
                            editableStructure={editableStructure}
                            setEditableStructure={setEditableStructure}
                            result={result}
                            validateFormatRealTime={validateFormatRealTime}
                          />
                        )}

                        {/* SY002和SY005的教学步骤区域 */}
                        {section.type === 'teaching_steps' && isSY002SY005Template && (
                          <SY002SY005TeachingStepsEditor
                            section={section}
                            sectionIndex={sectionIndex}
                            editableStructure={editableStructure}
                            setEditableStructure={setEditableStructure}
                            result={result}
                            validateFormatRealTime={validateFormatRealTime}
                          />
                        )}
                        
                        {/* 环节流程区域（SY001、SY003使用） */}
                        {section.type === 'segments' && !isSY002SY005Template && (
                          <div className="segments-editor">
                            {section.items && section.items.length > 0 ? (
                              section.items.map((segment, segmentIndex) => (
                              <div key={segmentIndex} className="segment-editor">
                                {/* 删除环节按钮 - 左上角 */}
                                {section.items.length > 1 && (
                                  <button
                                    className="delete-segment-button"
                                    onClick={() => {
                                      const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                      const items = newStructure.sections[sectionIndex].items || [];
                                      if (items.length > 1) {
                                        items.splice(segmentIndex, 1);
                                        // 重新编号
                                        items.forEach((seg, idx) => {
                                          seg.number = String(idx + 1);
                                        });
                                        setEditableStructure(newStructure);
                                        if (result?.templateFormatResult?.templateId) {
                                          validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                                        }
                                      }
                                    }}
                                    title="删除此环节"
                                  >
                                    ✕
                                  </button>
                                )}
                                <div className="segment-header">
                                  <input
                                    type="text"
                                    value={`环节${segment.number}：${segment.title}`}
                                    onChange={(e) => {
                                      const match = e.target.value.match(/环节(\d+)[：:](.+)/);
                                      if (match) {
                                        const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                        newStructure.sections[sectionIndex].items[segmentIndex].number = match[1];
                                        newStructure.sections[sectionIndex].items[segmentIndex].title = match[2].trim();
                                        setEditableStructure(newStructure);
                                        if (result?.templateFormatResult?.templateId) {
                                          validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                                        }
                                      }
                                    }}
                                    className="segment-title-input"
                                  />
                                  <input
                                    type="text"
                                    placeholder="时间（分钟）"
                                    value={segment.time || ''}
                                    onChange={(e) => {
                                      const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                      newStructure.sections[sectionIndex].items[segmentIndex].time = e.target.value;
                                      setEditableStructure(newStructure);
                                      if (result?.templateFormatResult?.templateId) {
                                        validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                                      }
                                    }}
                                    className="segment-time-input"
                                  />
                                </div>
                                {/* 操作方法（单一输入框） */}
                                {renderNumberedListEditor(
                                  '操作方法',
                                  'segment-method',
                                  'method',
                                  segment.method,
                                  sectionIndex,
                                  segmentIndex,
                                  '请输入操作方法（支持多行，按Enter换行）...'
                                )}

                                {/* 主/助教分工（仅当存在时显示） */}
                                {segment.division && (
                                  <div className="segment-division">
                                    <label>主/助教分工:</label>
                                    <textarea
                                      value={segment.division.value || ''}
                                      onChange={(e) => {
                                        const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                        if (!newStructure.sections[sectionIndex].items[segmentIndex].division) {
                                          newStructure.sections[sectionIndex].items[segmentIndex].division = { value: '' };
                                        }
                                        newStructure.sections[sectionIndex].items[segmentIndex].division.value = e.target.value;
                                        setEditableStructure(newStructure);
                                        if (result?.templateFormatResult?.templateId) {
                                          validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                                        }
                                      }}
                                      className="structure-textarea"
                                      rows="2"
                                    />
                                  </div>
                                )}
                                
                                {/* 教师指导语（单一输入框） */}
                                {renderNumberedListEditor(
                                  '教师指导语',
                                  'segment-guidance',
                                  'guidance',
                                  segment.guidance,
                                  sectionIndex,
                                  segmentIndex,
                                  '请输入教师指导语（支持多行，按Enter换行）...'
                                )}
                              </div>
                              ))
                            ) : (
                              <div className="no-segments-message">
                                <p>暂无环节流程数据</p>
                              </div>
                            )}
                            <div className="add-segment-row">
                              <button
                                className="add-segment-button"
                                onClick={() => {
                                  const newStructure = JSON.parse(JSON.stringify(editableStructure));
                                  if (!newStructure.sections[sectionIndex].items) {
                                    newStructure.sections[sectionIndex].items = [];
                                  }
                                  
                                  // 检查当前模板是否支持division字段（通过检查现有segments是否有division）
                                  const existingItems = newStructure.sections[sectionIndex].items;
                                  const hasDivision = existingItems.length > 0 && existingItems[0].division !== undefined;
                                  
                                  const nextNumber = existingItems.length + 1;
                                  const newSegment = {
                                    number: String(nextNumber),
                                    title: '',
                                    time: '',
                                    method: { 
                                      title: '操作方法', 
                                      items: [
                                        { number: '1', content: '' },
                                        { number: '2', content: '' },
                                        { number: '3', content: '' }
                                      ] 
                                    },
                                    guidance: { 
                                      title: '教师指导语', 
                                      items: [
                                        { number: '1', content: '' },
                                        { number: '2', content: '' },
                                        { number: '3', content: '' }
                                      ] 
                                    },
                                  };
                                  
                                  // 只有当模板支持division时才添加
                                  if (hasDivision) {
                                    newSegment.division = { title: '主/助教分工', value: '' };
                                  }
                                  
                                  newStructure.sections[sectionIndex].items.push(newSegment);
                                  setEditableStructure(newStructure);
                                  if (result?.templateFormatResult?.templateId) {
                                    validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
                                  }
                                }}
                              >
                                新增环节
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {result && (
                  <>
            <h2>处理结果</h2>
            
            <div className="result-card">
              <h3>文档信息</h3>
              <p><strong>编号：</strong>{result.documentInfo?.number || '未识别'}</p>
              <p><strong>名称：</strong>{result.documentInfo?.name || '未识别'}</p>
            </div>

                    {((result.typoResults && result.typoResults.length > 0) || result.llmTypoSummary || result.llmError) && (
              <div className="result-card">
                <h3>
                  错别字检测 
                  {result.typoResults && result.typoResults.length > 0 && (
                    <span className="badge">({result.typoResults.length} 个)</span>
                  )}
                  {result.llmTypoSummary && !result.llmError && (
                    <span className="llm-badge">🤖 LLM智能检测</span>
                  )}
                  {result.llmError && (
                    <span className="error-badge">⚠️ LLM未启用</span>
                  )}
                </h3>
                {result.llmError ? (
                  <div className="llm-error-notice">
                    <p><strong>⚠️ LLM智能检测未启用</strong></p>
                    <p>当前使用传统方法检测，检测能力有限。</p>
                    <p>建议配置LLM以获得更准确的错别字检测：</p>
                    <ol>
                      <li>安装Python依赖：<code>cd llm && pip install -r requirements.txt</code></li>
                      <li>配置API密钥：在 <code>llm/.env</code> 文件中设置 <code>MODELSCOPE_API_KEY</code></li>
                      <li>重启后端服务</li>
                    </ol>
                    {result.typoResults && result.typoResults.length > 0 && (
                      <div className="traditional-results">
                        <p><strong>传统方法检测结果：</strong></p>
                        <ul>
                          {result.typoResults.map((typo, index) => (
                            <li key={index}>
                              <span className="typo-word">"{typo.word}"</span> 
                              {' '}应改为{' '}
                              <span className="correct-word">"{typo.correct}"</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : result.llmTypoSummary ? (
                  <div className="llm-result">
                    <pre className="typo-summary">{result.llmTypoSummary}</pre>
                  </div>
                ) : result.typoResults && result.typoResults.length > 0 ? (
                <ul>
                  {result.typoResults.map((typo, index) => (
                    <li key={index}>
                      <span className="typo-word">"{typo.word}"</span> 
                      {' '}应改为{' '}
                      <span className="correct-word">"{typo.correct}"</span>
                      {typo.context && (
                        <div className="context">上下文: {typo.context}</div>
                      )}
                    </li>
                  ))}
                </ul>
                ) : (
                  <p>未检测到错别字（传统方法检测能力有限，建议使用LLM智能检测）</p>
                )}
              </div>
                    )}
                  </>
            )}

            {result && result.formatResults && result.formatResults.length > 0 && (
              <div className="result-card">
                <div className="format-issues-header">
                <h3>格式问题 ({result.formatResults.length} 个)</h3>
                  <button
                    className="expand-button"
                    onClick={() => setFormatIssuesExpanded(!formatIssuesExpanded)}
                  >
                    {formatIssuesExpanded ? '收起' : '展开'}
                  </button>
                </div>
                {formatIssuesExpanded && (
                  <ul className="format-issues-list">
                  {result.formatResults.map((issue, index) => (
                    <li key={index}>
                      {issue.description}
                      {issue.line && <span className="line-number"> (第 {issue.line} 行)</span>}
                    </li>
                  ))}
                </ul>
                )}
                {!formatIssuesExpanded && (
                  <div className="format-issues-preview">
                    <p>点击"展开"查看所有格式问题</p>
                    <ul className="format-issues-list">
                      {result.formatResults.slice(0, 3).map((issue, index) => (
                        <li key={index}>
                          {issue.description}
                          {issue.line && <span className="line-number"> (第 {issue.line} 行)</span>}
                        </li>
                      ))}
                      {result.formatResults.length > 3 && (
                        <li className="more-issues">...还有 {result.formatResults.length - 3} 个问题</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result && result.larkRecord && (
              <div className="result-card success">
                <h3>飞书登记状态</h3>
                <p>{result.larkRecord.message}</p>
                {result.larkRecord.recordId && (
                  <p className="record-id">记录ID: {result.larkRecord.recordId}</p>
                )}
              </div>
            )}

            {result && result.larkRecord?.recordId && (
              <div className="result-card review-section">
                <h3>教学评价与修改意见</h3>
                <div className="review-inputs">
                  <div className="input-group">
                    <label htmlFor="teaching-evaluation">教学评价（同步到飞书第三列）</label>
                    <textarea
                      id="teaching-evaluation"
                      className="review-textarea"
                      rows="4"
                      placeholder="请输入教学评价..."
                      value={teachingEvaluation}
                      onChange={(e) => setTeachingEvaluation(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="modification-comments">修改意见（同步到飞书第四列）</label>
                    <textarea
                      id="modification-comments"
                      className="review-textarea"
                      rows="4"
                      placeholder="请输入修改意见..."
                      value={modificationComments}
                      onChange={(e) => setModificationComments(e.target.value)}
                    />
                  </div>
                <button 
                    onClick={handleSyncToLark}
                    disabled={syncing}
                    className="sync-button"
                >
                    {syncing ? '同步中...' : '同步到飞书'}
                </button>
                </div>
              </div>
            )}


            {result && (
            <div className="success-message">
              {result.message || '处理完成！'}
              </div>
            )}
              </div>
              
              {/* 右侧：实时格式错误信息 */}
              {realTimeFormatErrors && (
                <div className="format-errors-panel">
                  <h3>格式验证</h3>
                  <div className={`format-status ${realTimeFormatErrors.isValid ? 'valid' : 'invalid'}`}>
                    {realTimeFormatErrors.isValid ? '✅ 格式正确' : '❌ 格式错误'}
                  </div>
                  
                  {realTimeFormatErrors.errorCount > 0 && (
                    <div className="errors-list">
                      <h4>错误 ({realTimeFormatErrors.errorCount})</h4>
                      <ul>
                        {realTimeFormatErrors.errors.map((error, index) => (
                          <li key={index} className="error-item">
                            {error.description}
                            {error.line && <span className="line-number"> (第{error.line}行)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {realTimeFormatErrors.warningCount > 0 && (
                    <div className="warnings-list">
                      <h4>警告 ({realTimeFormatErrors.warningCount})</h4>
                      <ul>
                        {realTimeFormatErrors.warnings.map((warning, index) => (
                          <li key={index} className="warning-item">
                            {warning.description}
                            {warning.line && <span className="line-number"> (第{warning.line}行)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
