# Skill 管理系统

## 功能概览

本功能添加了完整的 Skill 管理 UI，允许用户直接在应用内创建、编辑和删除 Skill，无需手动编辑文件。

## 新增文件

### 前端
- **src/components/Settings/SkillsSection.tsx** - Skill 管理 UI 组件
  - Skill 列表视图（左侧边栏）
  - Skill 编辑器（右侧主区域）
  - 创建/编辑/删除操作
  - 错误提示

### 后端
- **electron/skills/manager.ts** - Skill 文件系统操作
  - `createSkill()` - 创建新 skill
  - `updateSkill()` - 更新现有 skill
  - `deleteSkill()` - 删除 skill
  - 自动生成 SKILL.md 文件和 frontmatter

### 类型定义和集成
- **shared/types.ts** - 扩展 SkillsAPI 接口，添加 create/update/delete 方法
- **electron/ipc/skills.ts** - 扩展 IPC 处理器
- **electron/preload.ts** - 暴露新的 API 到渲染进程
- **src/stores/ui.ts** - 添加 'skills' 到 SettingsSection 类型
- **src/components/Settings/SettingsModal.tsx** - 集成到 Settings 模态框

## 使用指南

### 打开 Skill 管理
1. 在应用菜单中选择 **文件 → 设置**
2. 在左侧边栏中点击 **Skill** 图标（工具图标）
3. 即可看到 Skill 列表和编辑界面

### 创建新 Skill
1. 点击 **+ 新建 Skill** 按钮
2. 填写以下信息：
   - **Skill 名称**：如 "代码审查"、"翻译助手"
   - **描述**：简要说明 Skill 的用途
   - **系统提示词**：详细的 prompt 指令
3. 点击 **创建** 按钮

### 编辑现有 Skill
1. 从左侧列表中选择要编辑的 Skill
2. 修改名称、描述或提示词
3. 点击 **保存** 按钮

### 删除 Skill
1. 从左侧列表中选择要删除的 Skill
2. 点击 **删除** 按钮
3. 在确认对话框中确认

## 技术实现细节

### 文件存储结构
```
userData/
└── skills/
    ├── code-review/
    │   └── SKILL.md
    ├── translator/
    │   └── SKILL.md
    └── ...
```

### Skill 文件格式
Skill 被存储为 Markdown 文件，包含 YAML frontmatter：

```markdown
---
name: "代码审查"
description: "专业代码审查助手"
---

你是一个资深代码审查专家...
```

### 数据流
1. **创建 Skill**
   - UI → IPC(`skills:create`) → manager.ts → 文件系统 → SkillStore.reload()
   
2. **使用 Skill**
   - Composer 发送消息 → `sendMessage({skillId})` → runtime.ts
   - runtime 加载 skill.body → 注入系统提示词 → 发送给 LLM

### 错误处理
- 名称或描述为空：显示错误提示
- 文件系统错误：显示具体的错误信息
- 重复名称：自动附加序号（如 `translator-1`）

## 特点

✅ **即时体验** - 创建的 Skill 立即可用  
✅ **完整的 CRUD** - 创建、读取、更新、删除  
✅ **友好的 UI** - 直观的编辑界面  
✅ **自动保存** - frontmatter 自动生成  
✅ **错误恢复** - 完善的错误提示  

## 扩展建议

### 短期（下一版本）
- [ ] Skill 分类标签
- [ ] 导入/导出 Skill 为 JSON
- [ ] Skill 搜索和排序
- [ ] Skill 预览模式（测试 prompt）

### 中期
- [ ] 社区 Skill 市场
- [ ] Skill 参数化（支持 {{变量}} 替换）
- [ ] 版本控制和恢复

### 长期
- [ ] Skill 权限管理（团队协作）
- [ ] Skill 性能统计（哪些 Skill 最常用）
- [ ] AI 辅助 Skill 生成
