export const AGENT_LIMITS = {
  maxToolRounds: 10,
} as const;

import type { ShortcutDef } from '@shared/types';

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'new-conversation', label: '新建对话', keys: 'CmdOrCtrl+N',     global: false },
  { id: 'open-settings',    label: '打开设置', keys: 'CmdOrCtrl+,',     global: false },
  { id: 'close-window',     label: '关闭窗口', keys: 'CmdOrCtrl+W',     global: false },
  { id: 'search',           label: '搜索对话', keys: 'CmdOrCtrl+K',     global: false },
  { id: 'quick-question',   label: '快速提问', keys: 'CmdOrCtrl+Space', global: true  },
];
