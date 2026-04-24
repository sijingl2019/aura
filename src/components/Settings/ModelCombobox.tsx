import { useEffect, useMemo, useRef, useState } from 'react';
import type { DefaultModelRef, ProviderConfig } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';
import { ProviderIcon } from './ProviderIcon';

interface ModelComboboxProps {
  value: DefaultModelRef | null;
  onChange: (value: DefaultModelRef) => void;
  placeholder?: string;
  align?: 'left' | 'right';
  size?: 'md' | 'sm';
}

export function ModelCombobox({
  value,
  onChange,
  placeholder = '请选择模型',
  align = 'left',
  size = 'md',
}: ModelComboboxProps) {
  const providers = useSettingsStore((s) => s.providers);
  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const selectedProvider = value ? providers.find((p) => p.id === value.providerId) : undefined;
  const selectedModel = value
    ? selectedProvider?.models.find((m) => m.id === value.modelId)
    : undefined;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { provider: ProviderConfig; models: ProviderConfig['models'] }[] = [];
    for (const p of enabledProviders) {
      const models = q
        ? p.models.filter(
            (m) =>
              m.id.toLowerCase().includes(q) ||
              (m.name ?? '').toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q),
          )
        : p.models;
      if (models.length > 0) out.push({ provider: p, models });
    }
    return out;
  }, [enabledProviders, query]);

  const triggerHeight = size === 'sm' ? 'h-7' : 'h-9';
  const triggerPad = size === 'sm' ? 'px-2' : 'px-3';
  const triggerText = size === 'sm' ? 'text-xs' : 'text-sm';

  const valid = value && selectedProvider && selectedModel;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          `flex ${triggerHeight} w-full items-center gap-2 rounded-md border border-black/10 bg-surface ${triggerPad} ${triggerText} text-left text-ink transition-colors hover:border-accent/40 ` +
          (open ? 'border-accent/50' : '')
        }
      >
        {valid ? (
          <>
            <ProviderIcon provider={selectedProvider!} size={size === 'sm' ? 16 : 20} />
            <span className="flex-1 truncate">{selectedModel!.name ?? selectedModel!.id}</span>
            <span className="shrink-0 text-ink-subtle">|</span>
            <span className="shrink-0 truncate text-ink-muted">{selectedProvider!.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-ink-subtle">{placeholder}</span>
        )}
        <ChevronDownIcon />
      </button>

      {open && (
        <div
          className={
            'absolute z-30 mt-1 w-[320px] rounded-md border border-black/10 bg-surface shadow-lg ' +
            (align === 'right' ? 'right-0' : 'left-0')
          }
        >
          <div className="border-b border-black/5 p-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle">
                <SearchIcon />
              </span>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索模型…"
                className="h-8 w-full rounded-md border border-black/5 bg-surface-muted pl-8 pr-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            {groups.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-ink-subtle">
                {enabledProviders.length === 0
                  ? '请先在「模型服务」中启用至少一个提供商'
                  : '没有匹配的模型'}
              </div>
            )}
            {groups.map((g) => (
              <div key={g.provider.id} className="py-1">
                <div className="px-3 pb-1 text-[11px] font-medium text-ink-subtle">
                  {g.provider.name}
                </div>
                {g.models.map((m) => {
                  const selected =
                    value?.providerId === g.provider.id && value?.modelId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onChange({ providerId: g.provider.id, modelId: m.id });
                        setOpen(false);
                      }}
                      className={
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ' +
                        (selected
                          ? 'bg-accent/10 text-accent'
                          : 'text-ink hover:bg-surface-sunken')
                      }
                    >
                      <ProviderIcon provider={g.provider} size={18} />
                      <span className="flex-1 truncate">{m.name ?? m.id}</span>
                      <span className="shrink-0 text-xs text-ink-subtle">{g.provider.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6" cy="6" r="4" />
      <path d="M9 9l3 3" />
    </svg>
  );
}
