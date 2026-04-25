import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversationsStore } from '@/stores/conversations';
import { useUiStore } from '@/stores/ui';

interface AppMenuProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

type TopKey = 'file' | 'edit' | 'view' | 'help';

const SUBMENU_WIDTH = 240;

export function AppMenu({ anchor, open, onClose }: AppMenuProps) {
  const [active, setActive] = useState<TopKey | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Partial<Record<TopKey, HTMLButtonElement>>>({});
  const navigate = useNavigate();
  const create = useConversationsStore((s) => s.create);
  const openSettings = useUiStore((s) => s.openSettings);

  useEffect(() => {
    if (!open) { setActive(null); return; }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (mainRef.current?.contains(t)) return;
      if (subRef.current?.contains(t)) return;
      if (anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchor]);

  // Position main panel imperatively — avoids inline style prop
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el || !open) return;
    const rect = anchor?.getBoundingClientRect();
    el.style.top = `${(rect?.bottom ?? 36) + 2}px`;
    el.style.left = `${rect?.left ?? 8}px`;
  }, [open, anchor]);

  // Position submenu imperatively based on actual rendered panel rect
  useLayoutEffect(() => {
    const el = subRef.current;
    const panelEl = mainRef.current;
    if (!el || !panelEl || !active) return;

    const itemEl = itemRefs.current[active];
    if (!itemEl) return;

    const panelRect = panelEl.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const spaceRight = window.innerWidth - panelRect.right;

    el.style.top = `${itemRect.top}px`;
    el.style.minWidth = `${SUBMENU_WIDTH}px`;
    if (spaceRight >= SUBMENU_WIDTH) {
      el.style.left = `${panelRect.right + 2}px`;
      el.style.right = '';
    } else {
      el.style.right = `${window.innerWidth - panelRect.left + 2}px`;
      el.style.left = '';
    }
  }, [active]);

  if (!open) return null;

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
    <>
      <div
        ref={mainRef}
        className="fixed z-50 min-w-[140px] rounded-md border border-black/10 bg-surface py-1 shadow-lg"
      >
        {topItems.map((item) => (
          <button
            key={item.key}
            ref={(el) => { if (el) itemRefs.current[item.key] = el; }}
            type="button"
            onMouseEnter={() => setActive(item.key)}
            onFocus={() => setActive(item.key)}
            className={
              'flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm transition-colors ' +
              (active === item.key
                ? 'bg-surface-sunken text-ink'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')
            }
          >
            <span>{item.label}</span>
            <ChevronRightIcon />
          </button>
        ))}
      </div>

      {active && (
        <div
          ref={subRef}
          className="fixed z-50 rounded-md border border-black/10 bg-surface py-1 shadow-lg"
        >
          {active === 'file' && (
            <>
              <MenuItem label="New Conversation" shortcut="⌘N" onClick={handleNewConv} />
              <MenuItem label="Settings..." shortcut="⌘," onClick={handleSettings} />
              <MenuDivider />
              <MenuItem label="Close Window" shortcut="⌘W" onClick={handleCloseWindow} />
              <MenuItem label="Exit" onClick={handleCloseWindow} />
            </>
          )}
          {active !== 'file' && <EmptySubmenu />}
        </div>
      )}
    </>
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
