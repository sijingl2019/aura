import { useEffect, useRef, useState } from 'react';
import type { PopupParams } from '@shared/types';

const ACTION_LABELS: Record<string, string> = {
  translate: '翻译',
  explain: '解释',
  summarize: '总结',
};

export function PopupRoute() {
  const [params, setParams] = useState<PopupParams | null>(null);
  const [originalText, setOriginalText] = useState('');
  const [result, setResult] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [pinned, setPinned] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const streamIdRef = useRef('');

  useEffect(() => {
    void window.api.popup.getParams().then((p) => {
      if (!p) return;
      setParams(p);
      setOriginalText(p.text);
      startQuery(p);
    });

    const off = window.api.popup.onEvent((ev) => {
      if (ev.streamId !== streamIdRef.current) return;
      if (ev.type === 'text') setResult((r) => r + (ev.delta ?? ''));
      else if (ev.type === 'done') setStreaming(false);
      else if (ev.type === 'error') { setError(ev.message ?? '未知错误'); setStreaming(false); }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void window.api.popup.close();
      if (e.key === 'r' || e.key === 'R') handleRegenerate();
      if (e.key === 'c' || e.key === 'C') void handleCopy();
    };
    document.addEventListener('keydown', onKey);

    return () => { off(); document.removeEventListener('keydown', onKey); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startQuery(p: PopupParams) {
    setResult('');
    setError('');
    setStreaming(true);
    streamIdRef.current = p.streamId;
    void window.api.popup.query(p);
  }

  function handleRegenerate() {
    if (!params || streaming) return;
    startQuery(params);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
  }

  const handlePin = async () => {
    const next = !pinned;
    setPinned(next);
    await window.api.popup.setPin(next);
  };

  const actionLabel = params ? (ACTION_LABELS[params.action] ?? params.action) : '';

  return (
    <div className="flex h-screen flex-col bg-white text-[13px] text-gray-800 select-none overflow-hidden">
      {/* Title bar — draggable */}
      <div
        className="flex h-9 shrink-0 items-center gap-2 border-b border-black/8 bg-gray-50 px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent">
          <span className="text-[10px] font-bold text-white leading-none">Q</span>
        </div>
        <span className="flex-1 text-sm font-medium text-gray-700">{actionLabel}</span>

        {/* Toolbar buttons — not draggable */}
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <TitleBtn onClick={handlePin} title={pinned ? '取消置顶' : '置顶'}>
            <PinIcon active={pinned} />
          </TitleBtn>
          <TitleBtn onClick={() => void window.api.popup.minimize()} title="最小化">
            <MinimizeIcon />
          </TitleBtn>
          <TitleBtn onClick={() => void window.api.popup.close()} title="关闭" danger>
            <CloseIcon />
          </TitleBtn>
        </div>
      </div>

      {/* Show original toggle */}
      {originalText && (
        <div className="flex justify-end border-b border-black/5 px-4 py-1">
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {showOriginal ? '隐藏原文 ∧' : '显示原文 ∨'}
          </button>
        </div>
      )}
      {showOriginal && (
        <div className="border-b border-black/5 bg-gray-50 px-4 py-2 text-xs text-gray-500 max-h-24 overflow-y-auto">
          {originalText}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 leading-relaxed">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{result}</p>
            {streaming && (
              <span className="inline-block h-3.5 w-0.5 bg-gray-400 animate-pulse ml-0.5 align-middle" />
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-center gap-6 border-t border-black/8 bg-gray-50 px-4 py-2">
        <BottomBtn onClick={() => void window.api.popup.close()} shortcut="Esc" label="关闭">
          <CloseCircleIcon />
        </BottomBtn>
        <BottomBtn onClick={handleRegenerate} shortcut="R" label="重新生成" disabled={streaming}>
          <RegenerateIcon />
        </BottomBtn>
        <BottomBtn onClick={() => void handleCopy()} shortcut="C" label="复制" disabled={!result}>
          <CopySmIcon />
        </BottomBtn>
      </div>
    </div>
  );
}

function TitleBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${
        danger ? 'hover:bg-red-100 hover:text-red-600 text-gray-400' : 'hover:bg-black/8 text-gray-400 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function BottomBtn({
  children,
  onClick,
  shortcut,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  shortcut: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
    >
      {children}
      <span className="font-medium text-gray-400">{shortcut}</span>
      <span>{label}</span>
    </button>
  );
}

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4">
      <path d="M5 1l1 4H3L5 1zM5 5v6M3 5h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 6h8" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 2l7 7M9 2l-7 7" />
    </svg>
  );
}
function CloseCircleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="5.5" />
      <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" />
    </svg>
  );
}
function RegenerateIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2A5.5 5.5 0 102 7.5" />
      <path d="M2 2v3.5h3.5" />
    </svg>
  );
}
function CopySmIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="6" height="7" rx="1" />
      <path d="M8 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h1" />
    </svg>
  );
}
