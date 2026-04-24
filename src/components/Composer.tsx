import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DefaultModelRef, SkillListItem } from '@shared/types';
import { abortStream, sendMessage } from '@/lib/ipc';
import { useStreamingStore } from '@/stores/streaming';
import { useConversationsStore } from '@/stores/conversations';
import { useUiStore } from '@/stores/ui';
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
  const [pendingModel, setPendingModel] = useState<DefaultModelRef | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streaming = useStreamingStore();
  const setConversationModel = useConversationsStore((s) => s.setConversationModel);
  const isStreaming = streaming.streamId !== null;
  const pendingAction = useUiStore((s) => s.pendingSelectionAction);
  const clearPendingAction = useUiStore((s) => s.setPendingSelectionAction);

  useEffect(() => {
    window.api.skills.list().then(setSkills).catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (conversationId) setPendingModel(null);
  }, [conversationId]);

  useEffect(() => {
    if (!pendingAction) return;
    setInput(pendingAction.prompt);
    clearPendingAction(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [pendingAction, clearPendingAction]);

  const activeSkill = skills.find((s) => s.id === activeSkillId) ?? null;

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
    await sendMessage({
      conversationId: targetId,
      userText: text,
      skillId: activeSkillId ?? undefined,
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (value === '/' || (value.startsWith('/') && !value.includes(' '))) {
      setSkillPickerOpen(true);
    } else {
      setSkillPickerOpen(false);
    }
  };

  const pickSkill = (id: string) => {
    setActiveSkillId(id);
    setSkillPickerOpen(false);
    setInput('');
    textareaRef.current?.focus();
  };

  const query = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const filteredSkills = skillPickerOpen
    ? skills.filter(
        (s) => !query || s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query),
      )
    : [];

  return (
    <div className="border-t border-black/5 bg-surface px-6 py-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <ModelSwitcher
            conversationId={conversationId}
            pendingChoice={pendingModel}
            onPendingChange={setPendingModel}
          />
          {activeSkill && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
              <span>/ {activeSkill.name}</span>
              <button
                type="button"
                onClick={() => setActiveSkillId(null)}
                className="text-accent/70 hover:text-accent"
                title="移除 skill"
              >
                ×
              </button>
            </span>
          )}
        </div>
        <div className="relative rounded-2xl bg-surface-muted p-4 shadow-sm">
          {skillPickerOpen && filteredSkills.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 max-h-60 overflow-y-auto rounded-xl bg-surface shadow-lg ring-1 ring-black/5">
              {filteredSkills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSkill(s.id)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                >
                  <span className="font-medium text-ink">/ {s.name}</span>
                  <span className="text-xs text-ink-subtle">{s.description}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? '生成中…' : '输入 / 触发 skill,或直接发送消息'}
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
