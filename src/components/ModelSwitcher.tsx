import { useEffect } from 'react';
import type { DefaultModelRef } from '@shared/types';
import { useConversationsStore } from '@/stores/conversations';
import { useSettingsStore } from '@/stores/settings';
import { ModelCombobox } from './Settings/ModelCombobox';

interface ModelSwitcherProps {
  conversationId: string | null;
  pendingChoice: DefaultModelRef | null;
  onPendingChange: (ref: DefaultModelRef) => void;
}

export function ModelSwitcher({
  conversationId,
  pendingChoice,
  onPendingChange,
}: ModelSwitcherProps) {
  const conversation = useConversationsStore((s) =>
    conversationId ? s.list.find((c) => c.id === conversationId) : undefined,
  );
  const setConversationModel = useConversationsStore((s) => s.setConversationModel);
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const providers = useSettingsStore((s) => s.providers);
  const defaultModel = useSettingsStore((s) => s.defaultModel);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const pinned =
    conversation?.provider && conversation?.model
      ? { providerId: conversation.provider, modelId: conversation.model }
      : null;

  const current: DefaultModelRef | null = pinned ?? pendingChoice ?? defaultModel ?? null;
  const isFollowingDefault = !pinned && !pendingChoice && !!defaultModel;

  const currentValid = (() => {
    if (!current) return false;
    const p = providers.find((x) => x.id === current.providerId);
    if (!p || !p.enabled) return false;
    return p.models.some((m) => m.id === current.modelId);
  })();

  const handleChange = (ref: DefaultModelRef) => {
    if (conversationId) {
      void setConversationModel(conversationId, ref.providerId, ref.modelId);
    } else {
      onPendingChange(ref);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-[260px]">
        <ModelCombobox
          value={currentValid ? current : null}
          onChange={handleChange}
          placeholder="选择模型"
          size="sm"
        />
      </div>
      {isFollowingDefault && (
        <span className="text-[11px] text-ink-subtle">跟随默认</span>
      )}
    </div>
  );
}
