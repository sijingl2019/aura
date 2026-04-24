import { useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { ProviderIcon } from './ProviderIcon';
import { AddProviderDialog } from './AddProviderDialog';

interface ProviderListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProviderList({ selectedId, onSelect }: ProviderListProps) {
  const providers = useSettingsStore((s) => s.providers);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [providers, query]);

  return (
    <div className="flex w-[240px] shrink-0 flex-col border-r border-black/5 bg-surface-muted">
      <div className="px-3 pt-4 pb-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模型平台..."
            className="h-8 w-full rounded-md border border-black/5 bg-surface pl-8 pr-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((p) => {
          const active = p.id === selectedId;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ' +
                  (active
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')
                }
              >
                <ProviderIcon provider={p} size={24} />
                <span className="flex-1 truncate">{p.name}</span>
                {p.enabled && (
                  <span className="rounded-sm border border-emerald-300 px-1 text-[10px] font-medium text-emerald-600">
                    ON
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-2 py-2 text-xs text-ink-subtle">没有匹配的提供商</li>
        )}
      </ul>

      <div className="border-t border-black/5 px-3 py-3">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-black/10 text-sm text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
        >
          <PlusIcon />
          添加
        </button>
      </div>

      <AddProviderDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => onSelect(id)}
      />
    </div>
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}
