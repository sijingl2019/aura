import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DefaultModelRef, SkillListItem } from '@shared/types';
import { abortStream, sendMessage } from '@/lib/ipc';
import { useStreamingStore } from '@/stores/streaming';
import { useConversationsStore } from '@/stores/conversations';
import { ModelSwitcher } from './ModelSwitcher';

interface ComposerProps {
  conversationId: string | null;
  onNeedConversation: () => Promise<string>;
}

export function Composer({ conversationId, onNeedConversation }: ComposerProps) {
  const [input, setInput] = useState('');
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [pendingModel, setPendingModel] = useState<DefaultModelRef | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const streaming = useStreamingStore();
  const setConversationModel = useConversationsStore((s) => s.setConversationModel);
  const isStreaming = streaming.streamId !== null;

  useEffect(() => {
    const load = () => window.api.skills.list().then(setSkills).catch(() => setSkills([]));
    load();
    return window.api.skills.onUpdated(load);
  }, []);

  useEffect(() => {
    if (conversationId) setPendingModel(null);
  }, [conversationId]);

  const activeSkill = skills.find((s) => s.id === activeSkillId) ?? null;

  const query = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const filteredSkills = skillPickerOpen
    ? skills.filter(
        (s) => !query || s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query),
      )
    : [];

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    let targetId = conversationId;
    if (!targetId) {
      targetId = await onNeedConversation();
      if (pendingModel) {
        await setConversationModel(targetId, pendingModel.providerId, pendingModel.modelId);
        setPendingModel(null);
      }
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

  const pickSkill = (id: string) => {
    setActiveSkillId(id);
    setSkillPickerOpen(false);
    setInput('');
    textareaRef.current?.focus();
  };

  const closePicker = () => {
    setSkillPickerOpen(false);
    setHighlightedIndex(0);
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (value === '/' || (value.startsWith('/') && !value.includes(' '))) {
      setSkillPickerOpen(true);
      setHighlightedIndex(0);
    } else {
      closePicker();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (skillPickerOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filteredSkills.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSkills[highlightedIndex]) pickSkill(filteredSkills[highlightedIndex].id);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    const item = pickerRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  return (
    <div className="border-t border-black/5 bg-surface p-4">
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between gap-2">
          <ModelSwitcher
            conversationId={conversationId}
            pendingChoice={pendingModel}
            onPendingChange={setPendingModel}
          />
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
          {skillPickerOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-black/5">
              {filteredSkills.length > 0 ? (
                <div ref={pickerRef} className="max-h-56 overflow-y-auto">
                  {filteredSkills.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickSkill(s.id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        i === highlightedIndex ? 'bg-accent/10 text-accent' : 'hover:bg-surface-sunken'
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-xs font-bold text-accent">
                        /
                      </span>
                      <span className="flex-1 overflow-hidden">
                        <span className="block font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-ink-subtle">{s.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-center text-sm text-ink-subtle">
                  没有匹配的 Skill
                </div>
              )}
              <div className="border-t border-black/5 px-3 py-1.5 text-[11px] text-ink-subtle">
                ↑↓ 选择 &nbsp;·&nbsp; Enter 确认 &nbsp;·&nbsp; Esc 关闭
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? '生成中…' : '输入 / 触发 skill，或直接发送消息'}
            rows={2}
            disabled={isStreaming}
            className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-60"
          />
          <div className="mt-4 flex items-center justify-between text-ink-subtle">
            <span className="text-[11px] text-ink-subtle">
              {isStreaming ? '回车新行时暂停,点击停止可中断' : 'Enter 发送,Shift+Enter 换行'}
            </span>
            {isStreaming ? (
              <button
                type="button"
                onClick={() => abortStream()}
                className="rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-500 hover:bg-red-500/20"
              >
                停止
              </button>
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
