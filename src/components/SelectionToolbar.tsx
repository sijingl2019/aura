import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import type { SearchEngine, SelectionActionId } from '@shared/types';

const SEARCH_URLS: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  baidu: 'https://www.baidu.com/s?wd=',
  bing: 'https://www.bing.com/search?q=',
};

const POPUP_ACTIONS = new Set<SelectionActionId>(['translate', 'explain', 'summarize']);

export function SelectionToolbar() {
  const config = useSettingsStore((s) => s.selectionToolbar);
  const settingsOpen = useUiStore((s) => s.settingsOpen);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const hide = useCallback(() => setVisible(false), []);

  // In-app selection detection
  useEffect(() => {
    if (!config?.enabled || settingsOpen) { hide(); return; }

    const handleMouseUp = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      if (config.triggerMode === 'ctrl' && !e.ctrlKey) { hide(); return; }
      if (config.triggerMode === 'shortcut') return;

      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) { hide(); return; }
        const text = sel.toString().trim();
        if (!text) { hide(); return; }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setPosition({ x: rect.left + rect.width / 2, y: rect.top });
        setVisible(true);
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      hide();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { hide(); return; }
      if (config.triggerMode === 'shortcut' && e.altKey && e.code === 'KeyC') {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const text = sel.toString().trim();
        if (!text) return;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setPosition({ x: rect.left + rect.width / 2, y: rect.top });
        setVisible(true);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [config, settingsOpen, hide]);

  // Global selection events from main process (via selection-hook)
  useEffect(() => {
    if (!config?.enabled) return;
    const off = window.api.selection.onFromClipboard(({ text, dipX, dipY }) => {
      setSelectedText(text);
      if (dipX !== null && dipY !== null) {
        // Convert DIP screen coords to viewport-relative coords
        const viewportX = dipX - window.screenX;
        const viewportY = dipY - window.screenY;
        setPosition({ x: viewportX, y: viewportY });
      } else {
        setPosition({ x: window.innerWidth / 2, y: window.innerHeight - 80 });
      }
      setVisible(true);
    });
    return off;
  }, [config?.enabled]);

  const handleAction = async (actionId: SelectionActionId) => {
    hide();

    if (actionId === 'copy') {
      await navigator.clipboard.writeText(selectedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      return;
    }

    if (actionId === 'search') {
      const engine: SearchEngine = config?.searchEngine ?? 'google';
      const url = SEARCH_URLS[engine] + encodeURIComponent(selectedText);
      await window.api.window.openExternal(url);
      return;
    }

    if (POPUP_ACTIONS.has(actionId)) {
      // Convert viewport coords to screen coords for popup window placement
      const screenX = Math.round(window.screenX + position.x);
      const screenY = Math.round(window.screenY + position.y);
      await window.api.popup.open({ action: actionId, text: selectedText, screenX, screenY });
    }
  };

  if (!config?.enabled || !visible) return null;

  const enabledActions = [...config.actions]
    .filter((a) => a.enabled)
    .sort((a, b) => a.order - b.order);

  const clampedX = Math.max(120, Math.min(position.x, window.innerWidth - 120));
  const isNearTop = position.y < 56;
  const topStyle = isNearTop
    ? { top: position.y + 28, transform: 'translateX(-50%)' }
    : { top: position.y - 8, transform: 'translateX(-50%) translateY(-100%)' };

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        left: clampedX,
        zIndex: 9999,
        opacity: (config.opacity ?? 100) / 100,
        ...topStyle,
      }}
      className="flex items-center rounded-lg bg-white shadow-lg ring-1 ring-black/10 px-1 py-1 gap-0.5 select-none"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Brand badge */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent">
        <span className="text-[10px] font-bold text-white leading-none">Q</span>
      </div>

      <div className="mx-1 h-4 w-px bg-black/10" />

      {enabledActions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => void handleAction(action.id as SelectionActionId)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-gray-100 ${
            action.id === 'copy' && copied ? 'text-green-600' : 'text-gray-700'
          }`}
          title={action.label}
        >
          <ActionIcon id={action.id as SelectionActionId} copied={action.id === 'copy' && copied} />
          {!config.compact && (
            <span>{action.id === 'copy' && copied ? '已复制' : action.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function ActionIcon({ id, copied }: { id: SelectionActionId; copied: boolean }) {
  switch (id) {
    case 'translate':
      return (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 3h5M3.5 1v2M2 3c0 2 1.5 3.5 3.5 4" />
          <path d="M7 12l3-7 3 7M8 10h4" />
        </svg>
      );
    case 'explain':
      return (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6.5" cy="6.5" r="5.5" />
          <path d="M6.5 9V6.5M6.5 4.5v.1" />
        </svg>
      );
    case 'summarize':
      return (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h9M2 6.5h9M2 10h5" />
        </svg>
      );
    case 'search':
      return (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="5.5" r="4" />
          <path d="M11 11L8.5 8.5" />
        </svg>
      );
    case 'copy':
      return copied ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6.5l3 3 5-5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4" width="6" height="7" rx="1" />
          <path d="M8 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h1" />
        </svg>
      );
  }
}
