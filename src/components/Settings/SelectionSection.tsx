import { useEffect, useState } from 'react';
import type { SearchEngine, SelectionAction, SelectionActionId, SelectionToolbarConfig } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';

const DEFAULT_ACTIONS: SelectionAction[] = [
  { id: 'translate', label: '翻译', enabled: true, order: 0 },
  { id: 'explain', label: '解释', enabled: true, order: 1 },
  { id: 'summarize', label: '总结', enabled: true, order: 2 },
  { id: 'search', label: '搜索', enabled: true, order: 3 },
  { id: 'copy', label: '复制', enabled: true, order: 4 },
];

const RENDERER_DEFAULT: SelectionToolbarConfig = {
  enabled: true,
  compact: false,
  opacity: 100,
  actions: DEFAULT_ACTIONS,
  searchEngine: 'google',
};

export function SelectionSection() {
  const stored = useSettingsStore((s) => s.selectionToolbar);
  const save = useSettingsStore((s) => s.setSelectionToolbar);

  const cfg = stored ?? RENDERER_DEFAULT;

  const [enabled, setEnabled] = useState(cfg.enabled);
  const [compact, setCompact] = useState(cfg.compact);
  const [opacity, setOpacity] = useState(cfg.opacity);
  const [actions, setActions] = useState<SelectionAction[]>(cfg.actions);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(cfg.searchEngine ?? 'google');

  useEffect(() => {
    const c = stored ?? RENDERER_DEFAULT;
    setEnabled(c.enabled);
    setCompact(c.compact);
    setOpacity(c.opacity);
    setActions(c.actions);
    setSearchEngine(c.searchEngine ?? 'google');
  }, [stored]);

  const persist = (patch: Partial<SelectionToolbarConfig>) => {
    const next: SelectionToolbarConfig = {
      enabled, compact, opacity, actions, searchEngine, ...patch,
    };
    void save(next);
  };

  const toggleEnabled = (v: boolean) => { setEnabled(v); persist({ enabled: v }); };
  const toggleCompact = (v: boolean) => { setCompact(v); persist({ compact: v }); };
  const changeOpacity = (v: number) => { setOpacity(v); persist({ opacity: v }); };
  const changeSearchEngine = (v: SearchEngine) => { setSearchEngine(v); persist({ searchEngine: v }); };

  const toggleAction = (id: SelectionActionId) => {
    const next = actions.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a);
    setActions(next);
    persist({ actions: next });
  };

  const resetActions = () => {
    setActions(DEFAULT_ACTIONS);
    persist({ actions: DEFAULT_ACTIONS });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-black/5 px-8 py-5">
        <div className="text-base font-medium text-ink">划词助手</div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        <section className="rounded-xl border border-black/5 bg-surface-muted p-5">
          <ToggleRow
            label="启用"
            description="启用后在任意应用中划词,都会在选中位置下方弹出工具栏"
            checked={enabled}
            onChange={toggleEnabled}
          />
        </section>

        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-5">
          <h3 className="text-sm font-semibold text-ink">外观</h3>

          <ToggleRow
            label="紧凑模式"
            description="紧凑模式下,只显示图标,不显示文字"
            checked={compact}
            onChange={toggleCompact}
          />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm text-ink">透明度</span>
                <p className="text-xs text-ink-subtle mt-0.5">工具栏的默认透明度,100% 为完全不透明</p>
              </div>
              <span className="shrink-0 text-sm text-ink tabular-nums">{opacity}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={opacity}
              onChange={(e) => changeOpacity(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        </section>

        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink">搜索引擎</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">默认搜索引擎</span>
            <SegmentedControl
              value={searchEngine}
              options={[
                { value: 'google', label: 'Google' },
                { value: 'baidu', label: '百度' },
                { value: 'bing', label: 'Bing' },
              ]}
              onChange={changeSearchEngine}
            />
          </div>
        </section>

        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">功能</h3>
            <button
              type="button"
              onClick={resetActions}
              className="rounded-md border border-black/10 px-3 py-1 text-xs text-ink hover:bg-surface-sunken"
            >
              重置
            </button>
          </div>

          <div className="space-y-1">
            {[...actions].sort((a, b) => a.order - b.order).map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-sunken"
              >
                <div className="flex items-center gap-2">
                  <ActionDotIcon id={action.id as SelectionActionId} />
                  <span className="text-sm text-ink">{action.label}</span>
                </div>
                <Toggle checked={action.enabled} onChange={() => toggleAction(action.id as SelectionActionId)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ' +
        (checked ? 'bg-accent' : 'bg-black/15')
      }
    >
      <span
        className={
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ' +
          (checked ? 'translate-x-4' : 'translate-x-0.5')
        }
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="text-sm text-ink">{label}</span>
        {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={() => onChange(!checked)} />
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-black/5 p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            'rounded-md px-3 py-1 text-xs transition-colors ' +
            (value === opt.value
              ? 'bg-accent text-white shadow-sm'
              : 'text-ink-muted hover:text-ink')
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ActionDotIcon({ id }: { id: SelectionActionId }) {
  const colors: Record<SelectionActionId, string> = {
    translate: 'bg-blue-400',
    explain: 'bg-purple-400',
    summarize: 'bg-orange-400',
    search: 'bg-green-400',
    copy: 'bg-gray-400',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[id]}`} />;
}
