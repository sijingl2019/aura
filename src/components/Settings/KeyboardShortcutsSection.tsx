import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import type { ShortcutDef } from '@shared/types';

const isMac = /Mac/.test(navigator.platform);

function formatKeys(keys: string): string {
  return keys
    .split('+')
    .map((part) => {
      if (part === 'CmdOrCtrl') return isMac ? '⌘' : 'Ctrl';
      if (part === 'Shift') return isMac ? '⇧' : 'Shift';
      if (part === 'Alt') return isMac ? '⌥' : 'Alt';
      if (part === 'Space') return 'Space';
      return part;
    })
    .join(isMac ? '' : '+');
}

function recordKeydown(e: KeyboardEvent): string | null {
  // Ignore bare modifiers
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CmdOrCtrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

export function KeyboardShortcutsSection() {
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const loadShortcuts = useSettingsStore((s) => s.loadShortcuts);
  const setShortcutOverride = useSettingsStore((s) => s.setShortcutOverride);
  const resetShortcut = useSettingsStore((s) => s.resetShortcut);

  const [recording, setRecording] = useState<string | null>(null); // id being recorded

  useEffect(() => {
    if (shortcuts.length === 0) void loadShortcuts();
  }, [shortcuts.length, loadShortcuts]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') { setRecording(null); return; }
      const keys = recordKeydown(e);
      if (keys) {
        void setShortcutOverride(recording, keys).then(() => setRecording(null));
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [recording, setShortcutOverride]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-black/5 px-8 py-5">
        <h2 className="text-base font-semibold text-ink">快捷键</h2>
        <p className="mt-0.5 text-xs text-ink-muted">点击快捷键标签录入新按键，Esc 取消</p>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs text-ink-subtle">
              <th className="pb-2 font-medium">功能</th>
              <th className="pb-2 font-medium">快捷键</th>
              <th className="pb-2 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {shortcuts.map((s) => (
              <ShortcutRow
                key={s.id}
                shortcut={s}
                isRecording={recording === s.id}
                onStartRecord={() => setRecording(s.id)}
                onReset={() => void resetShortcut(s.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShortcutRow({
  shortcut,
  isRecording,
  onStartRecord,
  onReset,
}: {
  shortcut: ShortcutDef;
  isRecording: boolean;
  onStartRecord: () => void;
  onReset: () => void;
}) {
  return (
    <tr className="group">
      <td className="py-3 pr-4 text-sm text-ink">
        {shortcut.label}
        {shortcut.global && (
          <span className="ml-1.5 rounded bg-surface-sunken px-1 py-0.5 text-[10px] text-ink-subtle">
            全局
          </span>
        )}
      </td>
      <td className="py-3 pr-4">
        <button
          type="button"
          onClick={onStartRecord}
          className={
            'inline-flex min-w-[80px] items-center justify-center rounded-md border px-3 py-1 text-xs font-medium transition-colors ' +
            (isRecording
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-black/10 bg-surface-sunken text-ink hover:border-accent/50 hover:text-accent')
          }
        >
          {isRecording ? '按下新快捷键…' : formatKeys(shortcut.keys)}
        </button>
      </td>
      <td className="py-3">
        <button
          type="button"
          onClick={onReset}
          className="invisible text-xs text-ink-subtle hover:text-ink group-hover:visible"
          title="恢复默认"
        >
          重置
        </button>
      </td>
    </tr>
  );
}
