import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SelectionAction, SelectionActionId, ToolbarParams } from '@shared/types';

export function ToolbarRoute() {
  const [params, setParams] = useState<ToolbarParams | null>(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
  }, []);

  useEffect(() => {
    void window.api.toolbar.getParams().then((p) => {
      if (p) {
        setParams(p);
        setText(p.text);
      }
    });
    const off = window.api.toolbar.onUpdate(({ text: t }) => setText(t));
    return off;
  }, []);

  // Report actual rendered size to main so the window hugs the chip exactly.
  useLayoutEffect(() => {
    if (!chipRef.current || !params) return;
    const el = chipRef.current;
    const report = () => {
      const rect = el.getBoundingClientRect();
      void window.api.toolbar.resize({ width: rect.width, height: rect.height });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [params]);

  if (!params) return null;

  const enabledActions = [...params.actions]
    .filter((a) => a.enabled)
    .sort((a, b) => a.order - b.order);

  const handleAction = async (actionId: SelectionActionId) => {
    if (actionId === 'copy') {
      setCopied(true);
      setTimeout(() => setCopied(false), 800);
    }
    await window.api.toolbar.performAction({ actionId, text });
  };

  return (
    <div
      ref={chipRef}
      className="fixed left-0 top-0 inline-flex items-center rounded-full bg-white shadow-lg ring-1 ring-black/10 px-1.5 py-1 gap-0.5 select-none"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
        <span className="text-[10px] font-bold text-white leading-none">Q</span>
      </div>
      {enabledActions.map((action) => (
        <ToolbarButton
          key={action.id}
          action={action}
          compact={params.compact}
          copied={action.id === 'copy' && copied}
          onClick={() => void handleAction(action.id)}
        />
      ))}
    </div>
  );
}

function ToolbarButton({
  action,
  compact,
  copied,
  onClick,
}: {
  action: SelectionAction;
  compact: boolean;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-[12px] transition-colors hover:bg-gray-100 ${
        copied ? 'text-green-600' : 'text-gray-700'
      }`}
      title={action.label}
    >
      <ActionIcon id={action.id} copied={copied} />
      {!compact && <span className="whitespace-nowrap">{copied ? '已复制' : action.label}</span>}
    </button>
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
