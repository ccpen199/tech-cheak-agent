import React from 'react';

/**
 * SY004 模板专用：基本信息编辑区域
 * 行结构：
 *  - 第一行：绘本名称（左，大框） + 课时（右，小框）
 *  - 其余字段：教学目标 / 教学准备 / 绘本简介 / 阅读测评，各占一行
 */
export default function SY004BasicInfoEditor({
  section,
  sectionIndex,
  editableStructure,
  setEditableStructure,
  result,
  validateFormatRealTime,
}) {
  if (!section?.fields) return null;

  // 渲染带序号的多行字段（如：教学目标 / 教学准备）
  const renderNumberedField = (fieldName, label, placeholder) => {
    const fieldIndex = section.fields.findIndex((f) => f.name === fieldName);
    if (fieldIndex === -1) return null;

    const field = section.fields[fieldIndex];
    const dataAttrKey = 'data-basic-number-index';
    const dataAttrValue = `${sectionIndex}-${fieldIndex}-${fieldName}`;

    return (
      <div className="basic-info-row">
        <label className="basic-info-label">{label}:</label>
        <div className="basic-info-input-wrapper">
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
              placeholder={placeholder}
            />
          </div>
        </div>
      </div>
    );
  };

  const updateField = (fieldName, value) => {
    const newStructure = JSON.parse(JSON.stringify(editableStructure));
    const idx = newStructure.sections[sectionIndex].fields.findIndex(
      (f) => f.name === fieldName
    );
    if (idx !== -1) {
      newStructure.sections[sectionIndex].fields[idx].value = value;
      setEditableStructure(newStructure);
      if (result?.templateFormatResult?.templateId) {
        validateFormatRealTime(newStructure, result.templateFormatResult.templateId);
      }
    }
  };

  const getFieldValue = (fieldName) =>
    section.fields.find((f) => f.name === fieldName)?.value || '';

  // 过滤掉已单独处理的字段，以及 null/undefined 字段（如"阅读测评"如果不存在）
  const otherFields = section.fields.filter(
    (f) =>
      f &&
      f.name &&
      !['绘本名称', '课时', '教学目标', '教学准备'].includes(f.name)
  );

  return (
    <div className="basic-info-editor sy004-basic-info-editor">
      {/* 第一行：绘本名称 + 课时 */}
      <div className="basic-info-row basic-info-row-sy004-first">
        <div className="basic-info-quarter">
          <label className="basic-info-label">绘本名称:</label>
        </div>
        <div className="basic-info-quarter">
          <div className="basic-info-input-wrapper">
            <textarea
              value={getFieldValue('绘本名称')}
              onChange={(e) => updateField('绘本名称', e.target.value)}
              className="review-textarea"
              rows={2}
              placeholder="请输入绘本名称..."
            />
          </div>
        </div>
        <div className="basic-info-quarter basic-info-quarter-label">
          <label className="basic-info-label">课时:</label>
        </div>
        <div className="basic-info-quarter basic-info-quarter-small">
          <div className="basic-info-input-wrapper">
            <textarea
              value={getFieldValue('课时')}
              onChange={(e) => updateField('课时', e.target.value)}
              className="review-textarea"
              rows={2}
              placeholder="请输入课时..."
            />
          </div>
        </div>
      </div>

      {/* 教学目标（带序号） */}
      {renderNumberedField('教学目标', '教学目标', '请输入教学目标（支持多行，按Enter换行）...')}

      {/* 教学准备（带序号） */}
      {renderNumberedField('教学准备', '教学准备', '请输入教学准备（支持多行，按Enter换行）...')}

      {/* 其余字段：一行一个（绘本简介 / 阅读测评等） */}
      {otherFields.map((field) => (
        <div key={field.name} className="basic-info-row">
          <label className="basic-info-label">{field.name}:</label>
          <div className="basic-info-input-wrapper">
            <textarea
              value={field.value || ''}
              onChange={(e) => updateField(field.name, e.target.value)}
              className="review-textarea"
              rows={2}
              placeholder={`请输入${field.name}...`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


