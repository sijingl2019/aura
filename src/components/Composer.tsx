import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DefaultModelRef, SkillListItem, WorkspaceFile } from '@shared/types';
import { abortStream, sendMessage, steerStream } from '@/lib/ipc';
import { useStreamingStore } from '@/stores/streaming';
import { useConversationsStore } from '@/stores/conversations';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { ModelSwitcher } from './ModelSwitcher';

interface SlashCmd {
  id: string;
  name: string;
  hint: string;
}

const SLASH_COMMANDS: SlashCmd[] = [
  { id: '__clear',  name: 'clear',  hint: '开始新对话' },
  { id: '__abort',  name: 'abort',  hint: '中止当前生成' },
  { id: '__model',  name: 'model',  hint: '切换默认模型' },
  { id: '__memory', name: 'memory', hint: '查看 AI 记忆' },
  { id: '__tools',  name: 'tools',  hint: '查看可用工具' },
  { id: '__help',   name: 'help',   hint: '显示所有命令' },
];

interface ComposerProps {
  conversationId: string | null;
  onNeedConversation: () => Promise<string>;
  onNewConversation?: () => void;
}

// Find the active @ token before the cursor position.
// Returns null when there's no open @ reference (e.g. already has a trailing space).
function getAtToken(value: string, cursorPos: number): { start: number; query: string } | null {
  const before = value.slice(0, cursorPos);
  const atIdx = before.lastIndexOf('@');
  if (atIdx < 0) return null;
  const after = before.slice(atIdx + 1);
  if (after.includes(' ')) return null; // token already closed
  return { start: atIdx, query: after };
}

// Split an @ query into a directory prefix and a name filter.
// "@src/comp" → { dir: "src", nameFilter: "comp" }
// "@a"        → { dir: "",    nameFilter: "a" }
function parseAtQuery(query: string): { dir: string; nameFilter: string } {
  const slash = query.lastIndexOf('/');
  if (slash >= 0) return { dir: query.slice(0, slash), nameFilter: query.slice(slash + 1) };
  return { dir: '', nameFilter: query };
}

export function Composer({ conversationId, onNeedConversation, onNewConversation }: ComposerProps) {
  const [input, setInput] = useState('');
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillHighlight, setSkillHighlight] = useState(0);
  const [pendingModel, setPendingModel] = useState<DefaultModelRef | null>(null);
  const [cmdOutput, setCmdOutput] = useState<{ title: string; body: string } | null>(null);
  const [steerHint, setSteerHint] = useState(false);

  const [cwd, setCwd] = useState('');
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [fileHighlight, setFileHighlight] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skillPickerRef = useRef<HTMLDivElement>(null);
  const filePickerRef = useRef<HTMLDivElement>(null);

  const streaming = useStreamingStore();
  const setConversationModel = useConversationsStore((s) => s.setConversationModel);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const isStreaming = streaming.streamId !== null;

  // Load skills
  useEffect(() => {
    const load = () => window.api.skills.list().then(setSkills).catch(() => setSkills([]));
    load();
    return window.api.skills.onUpdated(load);
  }, []);

  // Load cwd and subscribe to changes
  useEffect(() => {
    window.api.workspace.getCwd().then(setCwd).catch(() => setCwd(''));
    return window.api.workspace.onCwdChanged(setCwd);
  }, []);

  useEffect(() => {
    if (conversationId) setPendingModel(null);
  }, [conversationId]);

  // Re-focus the textarea when streaming finishes — it gets disabled (and loses
  // focus) during generation, so without this the user must click it again.
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      textareaRef.current?.focus();
      setSteerHint(false);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const activeSkill = skills.find((s) => s.id === activeSkillId) ?? null;

  // ── Skill picker ──────────────────────────────────────────────────────────
  const skillQuery = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const filteredSkills = skillPickerOpen
    ? skills.filter(
        (s) => !skillQuery || s.name.toLowerCase().includes(skillQuery) || s.id.toLowerCase().includes(skillQuery),
      )
    : [];
  const filteredCmds = skillPickerOpen
    ? SLASH_COMMANDS.filter(
        (c) => !skillQuery || c.name.startsWith(skillQuery) || c.hint.includes(skillQuery),
      )
    : [];
  // Combined list: commands first, then skills — skillHighlight indexes into this
  const allPickerItems: Array<{ id: string; name: string; hint: string; isCmd: boolean }> = [
    ...filteredCmds.map((c) => ({ ...c, isCmd: true })),
    ...filteredSkills.map((s) => ({ id: s.id, name: s.name, hint: s.description, isCmd: false })),
  ];

  const pickSkill = (id: string) => {
    setActiveSkillId(id);
    setSkillPickerOpen(false);
    setInput('');
    textareaRef.current?.focus();
  };

  const executeCmd = async (id: string) => {
    setSkillPickerOpen(false);
    setSkillHighlight(0);
    setInput('');
    textareaRef.current?.focus();
    switch (id) {
      case '__clear':
        onNewConversation?.();
        break;
      case '__abort':
        await abortStream();
        break;
      case '__model':
        useUiStore.getState().openSettings('default-model');
        break;
      case '__memory': {
        const mem = await window.api.memory.read();
        const parts: string[] = [];
        if (mem.facts) parts.push(`**项目记忆（MEMORY.md）**\n${mem.facts}`);
        else parts.push('项目记忆为空');
        if (mem.profile) parts.push(`**用户记忆（USER.md）**\n${mem.profile}`);
        else parts.push('用户记忆为空');
        setCmdOutput({ title: '/memory — AI 记忆', body: parts.join('\n\n') });
        break;
      }
      case '__tools': {
        const tools = await window.api.llm.listTools();
        const body = tools.map((t) => `**${t.name}**\n  ${t.description}`).join('\n\n');
        setCmdOutput({ title: `/tools — 可用工具（${tools.length} 个）`, body });
        break;
      }
      case '__help': {
        const body = SLASH_COMMANDS.map((c) => `**/${c.name}** — ${c.hint}`).join('\n');
        setCmdOutput({ title: '/help — 可用命令', body });
        break;
      }
    }
  };

  const closeSkillPicker = () => {
    setSkillPickerOpen(false);
    setSkillHighlight(0);
  };

  // ── @ file picker ─────────────────────────────────────────────────────────
  const loadFiles = async (query: string) => {
    const { dir, nameFilter } = parseAtQuery(query);
    try {
      const result = await window.api.workspace.listFiles({ dir: dir || undefined, query: nameFilter || undefined });
      setFiles(result);
      setFileHighlight(0);
    } catch {
      setFiles([]);
    }
  };

  const openFilePicker = (query: string) => {
    setFilePickerOpen(true);
    void loadFiles(query);
  };

  const closeFilePicker = () => {
    setFilePickerOpen(false);
    setFiles([]);
    setFileHighlight(0);
  };

  const pickFile = (file: WorkspaceFile) => {
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const token = getAtToken(input, cursor);
    if (!token) return;

    if (file.isDir) {
      // Navigate into directory: update the @ token to dir/ and reload
      const before = input.slice(0, token.start);
      const after = input.slice(cursor);
      const newQuery = (parseAtQuery(token.query).dir
        ? parseAtQuery(token.query).dir + '/' + file.name
        : file.name) + '/';
      const newInput = before + '@' + newQuery + after;
      setInput(newInput);
      void loadFiles(newQuery);
      // Move cursor to end of the new @ token
      setTimeout(() => {
        const pos = before.length + 1 + newQuery.length;
        textareaRef.current?.setSelectionRange(pos, pos);
        textareaRef.current?.focus();
      }, 0);
    } else {
      // Insert file reference and close
      const before = input.slice(0, token.start);
      const after = input.slice(cursor);
      const newInput = before + '@' + file.path + ' ' + after;
      setInput(newInput);
      closeFilePicker();
      // Move cursor after the inserted reference
      setTimeout(() => {
        const pos = before.length + 1 + file.path.length + 1;
        textareaRef.current?.setSelectionRange(pos, pos);
        textareaRef.current?.focus();
      }, 0);
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    let targetId = conversationId;
    if (!targetId) {
      targetId = await onNeedConversation();
      // Always pin the resolved model on first message so future reopens are stable.
      const modelToPin = pendingModel ?? defaultModel;
      if (modelToPin) {
        await setConversationModel(targetId, modelToPin.providerId, modelToPin.modelId);
      }
      setPendingModel(null);
    }

    setInput('');
    const sid = activeSkillId;
    const sname = activeSkill?.name;
    setActiveSkillId(null);
    await sendMessage({
      conversationId: targetId,
      userText: text,
      skillId: sid ?? undefined,
      skillName: sname,
    });
  };

  // ── Steer (interject while the agent is running) ────────────────────────────
  const handleSteer = async () => {
    const text = input.trim();
    if (!text || !isStreaming) return;
    setInput('');
    closeSkillPicker();
    closeFilePicker();
    setSteerHint(true);
    await steerStream(text);
  };

  // ── Input handler ─────────────────────────────────────────────────────────
  const handleInput = (value: string) => {
    setInput(value);
    if (cmdOutput) setCmdOutput(null); // dismiss output card on new input

    // / skill / command picker
    if (value === '/' || (value.startsWith('/') && !value.includes(' '))) {
      setSkillPickerOpen(true);
      setSkillHighlight(0);
      closeFilePicker();
      return;
    }
    closeSkillPicker();

    // @ file picker – check for open @ token at current cursor
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const token = getAtToken(value, cursor);
    if (token !== null) {
      openFilePicker(token.query);
    } else {
      closeFilePicker();
    }
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (skillPickerOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSkillHighlight((i) => Math.min(i + 1, allPickerItems.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSkillHighlight((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = allPickerItems[skillHighlight];
        if (item) { if (item.isCmd) void executeCmd(item.id); else pickSkill(item.id); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeSkillPicker(); return; }
    }
    if (cmdOutput && e.key === 'Escape') { e.preventDefault(); setCmdOutput(null); return; }

    if (filePickerOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFileHighlight((i) => Math.min(i + 1, files.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFileHighlight((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); if (files[fileHighlight]) pickFile(files[fileHighlight]); return; }
      if (e.key === 'Escape')    { e.preventDefault(); closeFilePicker(); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) handleSteer();
      else handleSend();
    }
  };

  // Scroll highlighted items into view
  useEffect(() => {
    const item = skillPickerRef.current?.children[skillHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [skillHighlight]);

  useEffect(() => {
    const item = filePickerRef.current?.children[fileHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [fileHighlight]);

  // Abbreviated cwd for display
  const displayCwd = cwd
    ? cwd.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
    : '';

  const anyPickerOpen = skillPickerOpen || filePickerOpen || !!cmdOutput;

  return (
    <div className="border-t border-black/5 bg-surface p-4">
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between gap-2">
          <ModelSwitcher
            conversationId={conversationId}
            pendingChoice={pendingModel}
            onPendingChange={setPendingModel}
          />
          {displayCwd && (
            <button
              type="button"
              title={`工作空间: ${cwd}\n点击切换目录`}
              dir="rtl"
              className="max-w-[40%] truncate rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
              onClick={async () => {
                const chosen = await window.api.workspace.openFolderDialog();
                if (chosen) setCwd(chosen);
              }}
            >
              {displayCwd}
            </button>
          )}
        </div>
        <div className="relative rounded-2xl bg-surface-muted p-4 shadow-sm">
          {activeSkill && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                <span className="opacity-60">/</span>
                <span>{activeSkill.name}</span>
                <button
                  type="button"
                  onClick={() => setActiveSkillId(null)}
                  className="ml-0.5 text-accent/60 hover:text-accent"
                  title="移除 skill"
                >
                  ×
                </button>
              </span>
            </div>
          )}

          {/* Command output card */}
          {cmdOutput && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
                <span className="text-xs font-medium text-ink">{cmdOutput.title}</span>
                <button
                  type="button"
                  onClick={() => setCmdOutput(null)}
                  className="text-ink-subtle hover:text-ink"
                  title="关闭 (Esc)"
                >
                  ×
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-ink">
                {cmdOutput.body}
              </div>
            </div>
          )}

          {/* Skill / command picker */}
          {skillPickerOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-black/5">
              {allPickerItems.length > 0 ? (
                <div ref={skillPickerRef} className="max-h-56 overflow-y-auto">
                  {allPickerItems.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => item.isCmd ? void executeCmd(item.id) : pickSkill(item.id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        i === skillHighlight ? 'bg-accent/10 text-accent' : 'hover:bg-surface-sunken'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        item.isCmd ? 'bg-ink/8 text-ink-muted' : 'bg-accent/10 text-accent'
                      }`}>
                        {item.isCmd ? '⌘' : '/'}
                      </span>
                      <span className="flex-1 overflow-hidden">
                        <span className="block font-medium">{item.isCmd ? `/${item.name}` : item.name}</span>
                        <span className="block truncate text-xs text-ink-subtle">{item.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-center text-sm text-ink-subtle">没有匹配的命令或 Skill</div>
              )}
              <div className="border-t border-black/5 px-3 py-1.5 text-[11px] text-ink-subtle">
                ↑↓ 选择 &nbsp;·&nbsp; Enter 确认 &nbsp;·&nbsp; Esc 关闭
              </div>
            </div>
          )}

          {/* @ file picker */}
          {filePickerOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-black/5">
              {files.length > 0 ? (
                <div ref={filePickerRef} className="max-h-64 overflow-y-auto">
                  {files.map((f, i) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => pickFile(f)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        i === fileHighlight ? 'bg-accent/10 text-accent' : 'hover:bg-surface-sunken'
                      }`}
                    >
                      <span className="text-base leading-none">{f.isDir ? '📁' : '📄'}</span>
                      <span className="flex-1 overflow-hidden">
                        <span className="block truncate font-medium">{f.name}</span>
                        {f.path !== f.name && (
                          <span className="block truncate text-xs opacity-60">{f.path}</span>
                        )}
                      </span>
                      {f.isDir && <span className="text-xs opacity-40">→</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-center text-sm text-ink-subtle">没有匹配的文件</div>
              )}
              <div className="border-t border-black/5 px-3 py-1.5 text-[11px] text-ink-subtle">
                ↑↓ 选择 &nbsp;·&nbsp; Enter 确认 &nbsp;·&nbsp; Esc 关闭 &nbsp;·&nbsp; 📁 进入目录
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? '插话引导 agent…（Enter 发送）' : '输入 / 触发 skill，@ 引用文件，或直接发送消息'}
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-60"
          />
          <div className="mt-4 flex items-center justify-between text-ink-subtle">
            <span className="text-[11px] text-ink-subtle">
              {isStreaming
                ? steerHint
                  ? '插话已发送，将在当前步骤后送达 agent'
                  : '生成中 · Enter 插话引导，点击停止可中断'
                : anyPickerOpen
                  ? '↑↓ 导航 · Enter 选择 · Esc 关闭'
                  : 'Enter 发送，Shift+Enter 换行'}
            </span>
            {isStreaming ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSteer}
                  disabled={!input.trim()}
                  className="rounded-md bg-accent px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
                  title="插话引导正在运行的 agent"
                >
                  插话
                </button>
                <button
                  type="button"
                  onClick={() => abortStream()}
                  className="rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-500 hover:bg-red-500/20"
                >
                  停止
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-md bg-accent px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
              >
                发送
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
