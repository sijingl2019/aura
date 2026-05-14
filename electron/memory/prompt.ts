import { readMemoryFile } from './store';

const MEMORY_GUIDANCE = `你拥有跨会话的持久记忆系统，通过以下工具管理：
- **memory_read(key)** — 读取 "facts"（事实记忆）或 "profile"（用户画像）
- **memory_append(key, entry)** — 追加新记录（自动加日期标题）
- **memory_write(key, content)** — 覆盖整个文件（重组时使用，请先 memory_read）

**何时主动更新记忆**：
1. 用户明确要求记住某件事时
2. 发现用户重要偏好、习惯或专业背景时 → 更新 profile
3. 形成重要技术决策、架构约定或禁忌时 → 更新 facts
4. 关键项目信息（路径、规范、已知问题）时 → 更新 facts

**不要**因普通问答或临时代码而写入记忆。`.trim();

/**
 * Build the memory block injected into every system prompt.
 * Always includes the guidance so the AI knows memory tools exist.
 * Appends file contents only when non-empty.
 */
export function buildMemorySection(): string {
  const facts = readMemoryFile('facts').trim();
  const profile = readMemoryFile('profile').trim();

  const parts: string[] = ['## 持久记忆\n', MEMORY_GUIDANCE];

  if (facts) {
    parts.push('\n### 事实记忆 (MEMORY.md)\n');
    parts.push(facts);
  }

  if (profile) {
    parts.push('\n### 用户画像 (USER.md)\n');
    parts.push(profile);
  }

  return parts.join('\n');
}
