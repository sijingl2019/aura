import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/stores/ui';
import { useConversationsStore } from '@/stores/conversations';
import type { ConversationSearchResult } from '@shared/types';

export function SearchDialog({ onNavigate }: { onNavigate: (id: string) => void }) {
  const open = useUiStore((s) => s.searchOpen);
  const close = useUiStore((s) => s.closeSearch);
  const conversations = useConversationsStore((s) => s.list);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConversationSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const recentResults = useCallback(
    () =>
      conversations.slice(0, 12).map((c) => ({
        conversationId: c.id,
        conversationTitle: c.title,
        updatedAt: c.updatedAt,
      })),
    [conversations],
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    setResults(recentResults());
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, recentResults]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults(recentResults());
      setSelectedIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await window.api.db.searchConversations({ query: query.trim() });
      setResults(res);
      setSelectedIndex(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open, recentResults]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (id: string) => {
      close();
      onNavigate(id);
    },
    [close, onNavigate],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const result = results[selectedIndex];
        if (result) handleSelect(result.conversationId);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, results, selectedIndex, handleSelect]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/30 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-[580px] max-w-[92vw] overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2.5 border-b border-black/5 px-4 py-3">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索对话…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-0.5 text-ink-subtle hover:text-ink"
            >
              <ClearIcon />
            </button>
          ) : (
            <kbd className="rounded border border-black/10 px-1.5 py-0.5 text-xs text-ink-subtle">
              Esc
            </kbd>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[56vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-subtle">
              {query.trim() ? '未找到相关对话' : '暂无对话'}
            </div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-1 text-xs text-ink-subtle">
                {query.trim() ? '搜索结果' : '最近对话'}
              </div>
              <ul ref={listRef} className="pb-2">
                {results.map((r, i) => (
                  <li key={r.conversationId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r.conversationId)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={
                        'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors ' +
                        (i === selectedIndex ? 'bg-surface-sunken' : '')
                      }
                    >
                      <div className="flex items-center gap-2">
                        <ChatIcon />
                        <span className="truncate text-sm font-medium text-ink">
                          {r.conversationTitle}
                        </span>
                      </div>
                      {r.snippet && (
                        <span className="line-clamp-1 pl-6 text-xs text-ink-muted">
                          {r.snippet}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="shrink-0 text-ink-muted"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-ink-muted"
    >
      <path d="M2 2.5h10a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H4l-2 2V3a.5.5 0 0 1 .5-.5z" />
    </svg>
  );
}
