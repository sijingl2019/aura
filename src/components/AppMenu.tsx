import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversationsStore } from '@/stores/conversations';
import { useUiStore } from '@/stores/ui';

interface AppMenuProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

type TopKey = 'file' | 'edit' | 'view' | 'help';

export function AppMenu({ anchor, open, onClose }: AppMenuProps) {
  const [active, setActive] = useState<TopKey>('file');
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const create = useConversationsStore((s) => s.create);
  const openSettings = useUiStore((s) => s.openSettings);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      if (anchor && anchor.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  const rect = anchor?.getBoundingClientRect();
  const top = (rect?.bottom ?? 36) + 2;
  const left = rect?.left ?? 8;

  const close = () => onClose();

  const handleNewConv = async () => {
    close();
    const conv = await create();
    navigate(`/c/${conv.id}`);
  };

  const handleSettings = () => {
    close();
    openSettings('providers');
  };

  const handleCloseWindow = () => {
    close();
    void window.api.window.close();
  };

  const topItems: { key: TopKey; label: string }[] = [
    { key: 'file', label: 'File' },
    { key: 'edit', label: 'Edit' },
    { key: 'view', label: 'View' },
    { key: 'help', label: 'Help' },
  ];

  return (
    <div
      ref={rootRef}
      className="fixed z-50 flex rounded-md border border-black/10 bg-surface shadow-lg"
      style={{ top, left }}
    >
      <ul className="min-w-[120px] py-1">
        {topItems.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onMouseEnter={() => setActive(item.key)}
              onFocus={() => setActive(item.key)}
              className={
                'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ' +
                (active === item.key
                  ? 'bg-surface-sunken text-ink'
                  : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')
              }
            >
              <span>{item.label}</span>
              <ChevronRightIcon />
            </button>
          </li>
        ))}
      </ul>

      <div className="min-w-[220px] border-l border-black/5 py-1">
        {active === 'file' && (
          <>
            <MenuItem label="New Conversation" shortcut="Ctrl+N" onClick={handleNewConv} />
            <MenuItem label="Settings..." shortcut="Ctrl+逗号" onClick={handleSettings} />
            <MenuDivider />
            <MenuItem label="Close Window" shortcut="Ctrl+W" onClick={handleCloseWindow} />
            <MenuItem label="Exit" onClick={handleCloseWindow} />
          </>
        )}
        {active === 'edit' && <EmptySubmenu />}
        {active === 'view' && <EmptySubmenu />}
        {active === 'help' && <EmptySubmenu />}
      </div>
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:text-ink-subtle/60"
    >
      <span>{label}</span>
      {shortcut && <span className="text-xs text-ink-subtle">{shortcut}</span>}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-black/5" />;
}

function EmptySubmenu() {
  return <div className="px-3 py-1.5 text-xs text-ink-subtle">暂无条目</div>;
}

function ChevronRightIcon(): ReactNode {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 2l3 3-3 3" />
    </svg>
  );
}
