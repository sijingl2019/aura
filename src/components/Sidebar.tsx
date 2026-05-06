import { useEffect } from 'react';
import { useConversationsStore } from '@/stores/conversations';

interface SidebarProps {
  onSelect?: (id: string) => void;
}

export function Sidebar({ onSelect }: SidebarProps) {
  const { list, activeId, loadList, create, remove, select } = useConversationsStore();

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleNew = async () => {
    const conv = await create();
    onSelect?.(conv.id);
  };

  const handleSelect = (id: string) => {
    select(id);
    onSelect?.(id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    const label = title.trim() || '此对话';
    if (!confirm(`确定删除「${label}」吗？删除后不可恢复。`)) return;
    await remove(id);
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-surface-muted px-3 py-4">
      <button
        type="button"
        onClick={handleNew}
        className="w-full rounded-xl bg-surface px-3 py-2 text-left text-sm shadow-sm hover:bg-surface-sunken"
      >
        + 新建对话
      </button>

      <div className="mt-4 flex-1 overflow-y-auto">
        {list.length === 0 && (
          <div className="mt-2 text-xs text-ink-subtle">暂无对话</div>
        )}
        <ul className="flex flex-col gap-1">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => handleSelect(c.id)}
                className={
                  'group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ' +
                  (activeId === c.id
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:bg-surface-sunken')
                }
              >
                <span className="truncate">{c.title}</span>
                <span
                  role="button"
                  onClick={(e) => handleDelete(e, c.id, c.title)}
                  className="ml-2 hidden shrink-0 rounded px-1 text-xs text-ink-subtle hover:bg-red-500/10 hover:text-red-500 group-hover:inline"
                  title="删除"
                >
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
