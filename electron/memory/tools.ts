import type { Tool } from '../tools/types';
import { ok, fail } from '../tools/types';
import { readMemoryFile, writeMemoryFile, appendMemoryFile, type MemoryKey } from './store';

const VALID_KEYS = new Set<string>(['facts', 'profile']);

function validateKey(k: unknown): k is MemoryKey {
  return typeof k === 'string' && VALID_KEYS.has(k);
}

const KEY_LABEL: Record<MemoryKey, string> = {
  facts: '事实记忆 (MEMORY.md)',
  profile: '用户画像 (USER.md)',
};

const memoryReadTool: Tool = {
  name: 'memory_read',
  description:
    '读取持久记忆文件内容。key="facts" 读取事实记忆（跨会话保留的项目/决策信息），key="profile" 读取用户画像（偏好/背景）。',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        enum: ['facts', 'profile'],
        description: '"facts" — 事实记忆；"profile" — 用户画像',
      },
    },
    required: ['key'],
  },
  async execute(input) {
    const { key } = (input as { key?: unknown }) ?? {};
    if (!validateKey(key)) return fail('key 必须是 "facts" 或 "profile"');
    const content = readMemoryFile(key).trim();
    return ok(content || `（${KEY_LABEL[key]} 暂无内容）`);
  },
};

const memoryWriteTool: Tool = {
  name: 'memory_write',
  description:
    '覆盖写入持久记忆文件（完全替换原内容）。适合重组/精简记忆。写入前请先用 memory_read 读取现有内容以免丢失。',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        enum: ['facts', 'profile'],
        description: '"facts" — 事实记忆；"profile" — 用户画像',
      },
      content: {
        type: 'string',
        description: '新的记忆内容（推荐 Markdown 格式，最多 50000 字符）',
      },
    },
    required: ['key', 'content'],
  },
  async execute(input) {
    const { key, content } = (input as { key?: unknown; content?: unknown }) ?? {};
    if (!validateKey(key)) return fail('key 必须是 "facts" 或 "profile"');
    if (typeof content !== 'string') return fail('缺少 content 参数');
    if (content.length > 50_000) return fail('内容过长（最多 50000 字符）');
    writeMemoryFile(key, content);
    return ok(`已更新 ${KEY_LABEL[key]}`);
  },
};

const memoryAppendTool: Tool = {
  name: 'memory_append',
  description:
    '向持久记忆追加一条新记录（自动附加当天日期标题）。适合快速记下新发现，无需重写整个文件。',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        enum: ['facts', 'profile'],
        description: '"facts" — 追加到事实记忆；"profile" — 追加到用户画像',
      },
      entry: {
        type: 'string',
        description: '要追加的内容（最多 5000 字符）',
      },
    },
    required: ['key', 'entry'],
  },
  async execute(input) {
    const { key, entry } = (input as { key?: unknown; entry?: unknown }) ?? {};
    if (!validateKey(key)) return fail('key 必须是 "facts" 或 "profile"');
    if (typeof entry !== 'string') return fail('缺少 entry 参数');
    if (entry.length > 5_000) return fail('entry 过长（最多 5000 字符）');
    appendMemoryFile(key, entry);
    return ok(`已追加到 ${KEY_LABEL[key]}`);
  },
};

export function createMemoryTools(): Tool[] {
  return [memoryReadTool, memoryWriteTool, memoryAppendTool];
}
