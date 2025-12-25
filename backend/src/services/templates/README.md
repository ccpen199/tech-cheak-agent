# 模板解析器架构说明

## 架构设计

采用**工厂模式 + 继承模式**，支持多模板扩展：

```
BaseTemplateParser (基础类)
  ├── SY001TemplateParser (节庆活动方案)
  ├── SY002TemplateParser (体适能课)
  ├── SY003TemplateParser (主题活动通用)
  ├── SY004TemplateParser (绘本剧)
  └── SY005TemplateParser (食育课)

TemplateParserFactory (工厂类)
  └── 自动识别模板类型并返回对应的解析器
```

## 模板结构分析

### SY001 - 童萌-节庆活动方案模板
- **基本信息**：节日、活动名称、材料
- **环节流程**：环节1、环节2...（每个环节有：操作方法、主/助教分工、教师指导语）

### SY002 - 童萌-体适能课模板
- **基本信息**：课程编号、课程目标、课程材料
- **教学步骤**：1. 热身+引入、2. 动作技能...（每个步骤下有：游戏1、游戏2，每个游戏有指导语）

### SY003 - 童萌-主题活动通用模板
- **基本信息**：课程名称、物资准备、注意事项
- **环节流程**：环节1、环节2...（每个环节有：操作方法、教师指导语，**没有主/助教分工**）

### SY004 - 童萌-绘本剧模板
- **基本信息**：绘本名称、课时、教学目标、教学准备、绘本简介
- **教学过程**：
  - 导入环节
  - 精读环节（观察封面、前环衬页、扉页介绍、正文精读P1-Px）
  - 拓展环节（拓展方式1、拓展方式2...）

### SY005 - 童萌-食育课模板
- **基本信息**：课程编号、课程目标、课程材料
- **材料分类**：实物教具、视觉教具、工具类
- **教学步骤**：类似SY002（1. 热身+引入、2. 五感探索...，每个步骤下有游戏和指导语）

## 使用方式

### 自动识别模板
```javascript
import { TemplateParserFactory } from './templates/TemplateParserFactory.js';

// 自动识别模板类型并解析
const result = await TemplateParserFactory.parseDocument(filePath);
```

### 指定模板类型
```javascript
// 明确指定模板ID
const result = await TemplateParserFactory.parseDocument(filePath, 'SY001');
```

### 获取特定解析器
```javascript
// 获取解析器实例
const parser = TemplateParserFactory.getParser('SY001');
const result = await parser.parseDocument(filePath);
```

## 扩展新模板

1. **创建新的解析器类**（继承 `BaseTemplateParser`）：
```javascript
// SY006TemplateParser.js
import { BaseTemplateParser } from './BaseTemplateParser.js';

export class SY006TemplateParser extends BaseTemplateParser {
  constructor() {
    super('SY006', '模板名称');
  }

  static identify(text) {
    return /识别模式/.test(text);
  }

  parseStructure(text, html) {
    // 实现解析逻辑
  }
}
```

2. **在工厂类中注册**：
```javascript
// TemplateParserFactory.js
import { SY006TemplateParser } from './SY006TemplateParser.js';

const parsers = {
  // ...
  'SY006': () => new SY006TemplateParser(),
};
```

## 下一步工作

1. ✅ 完成5个模板的基础解析器（骨架已创建）
2. ⏳ 根据实际模板内容完善每个解析器的解析逻辑
3. ⏳ 为每个模板创建对应的格式检查器
4. ⏳ 为每个模板创建对应的文档生成器
5. ⏳ 前端适配不同模板的编辑界面

## 注意事项

- 模板识别按优先级顺序（更具体的模板先识别）
- 每个模板解析器必须实现 `parseStructure` 方法
- 每个模板解析器应该实现静态 `identify` 方法用于自动识别

