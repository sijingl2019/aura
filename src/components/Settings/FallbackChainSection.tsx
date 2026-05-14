import { useSettingsStore } from '@/stores/settings';
import type { FallbackChainEntry } from '@shared/types';
import { useState } from 'react';
import { ModelCombobox } from './ModelCombobox';
import { ProviderIcon } from './ProviderIcon';

export function FallbackChainSection() {
  const providers = useSettingsStore((s) => s.providers);
  const fallbackChain = useSettingsStore((s) => s.fallbackChain);
  const setFallbackChain = useSettingsStore((s) => s.setFallbackChain);

  const [pending, setPending] = useState<FallbackChainEntry | null>(null);

  const remove = (idx: number) => {
    const next = fallbackChain.filter((_, i) => i !== idx);
    void setFallbackChain(next);
  };

  const addPending = () => {
    if (!pending) return;
    // Avoid duplicates
    const already = fallbackChain.some(
      (e) => e.providerId === pending.providerId && e.modelId === pending.modelId,
    );
    if (!already) {
      void setFallbackChain([...fallbackChain, pending]);
    }
    setPending(null);
  };

  const resolveLabel = (entry: FallbackChainEntry) => {
    const p = providers.find((p) => p.id === entry.providerId);
    const m = p?.models.find((m) => m.id === entry.modelId);
    return { providerName: p?.name ?? entry.providerId, modelName: m?.name ?? entry.modelId, provider: p };
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-black/5 px-8 py-5">
        <div className="text-base font-medium text-ink">降级模型链</div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <p className="text-sm text-ink-subtle">
          当主模型遇到速率限制、服务过载或模型不可用时，自动按顺序尝试备用模型。
          切换仅在首次 API 调用失败（无任何流式内容输出）时触发。
        </p>

        {/* Chain list */}
        <section>
          <div className="mb-3 text-sm font-medium text-ink">当前降级链</div>
          {fallbackChain.length === 0 ? (
            <div className="rounded-lg border border-dashed border-black/10 px-4 py-6 text-center text-sm text-ink-subtle">
              暂未配置备用模型。添加至少一个备用模型以启用自动降级。
            </div>
          ) : (
            <ol className="space-y-2">
              {fallbackChain.map((entry, idx) => {
                const { providerName, modelName, provider } = resolveLabel(entry);
                return (
                  <li
                    key={`${entry.providerId}__${entry.modelId}__${idx}`}
                    className="flex items-center gap-3 rounded-lg border border-black/5 bg-surface px-3 py-2.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-ink-subtle">
                      {idx + 1}
                    </span>
                    {provider && (
                      <ProviderIcon provider={provider} size={18} />
                    )}
                    <span className="flex-1 truncate text-sm text-ink">
                      <span className="font-medium">{providerName}</span>
                      <span className="mx-1 text-ink-subtle">/</span>
                      <span className="text-ink-subtle">{modelName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="shrink-0 rounded p-1 text-ink-subtle hover:bg-red-50 hover:text-red-500"
                      title="移除"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Add new entry */}
        <section>
          <div className="mb-2 text-sm font-medium text-ink">添加备用模型</div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <ModelCombobox
                value={pending}
                onChange={(v) => setPending(v)}
                placeholder="选择备用模型"
                size="sm"
              />
            </div>
            <button
              type="button"
              onClick={addPending}
              disabled={!pending}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            >
              添加
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-subtle">
            触发条件：HTTP 429 速率限制 / 503&amp;529 过载 / 404 模型不存在 / 5xx 服务错误。
          </p>
        </section>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M11.5 3.5l-.7 7.5a1 1 0 01-1 .9H4.2a1 1 0 01-1-.9L2.5 3.5" />
    </svg>
  );
}
