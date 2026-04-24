import { useEffect, useState } from 'react';
import type { GlobalSelectionMode, SearchEngine, SelectionAction, SelectionActionId, SelectionTriggerMode, SelectionToolbarConfig } from '@shared/types';
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
  triggerMode: 'select',
  compact: false,
  followToolbar: true,
  rememberSize: false,
  autoClose: true,
  alwaysOnTop: false,
  opacity: 100,
  actions: DEFAULT_ACTIONS,
  searchEngine: 'google',
  globalMode: 'off',
  globalShortcut: 'Alt+W',
};

export function SelectionSection() {
  const stored = useSettingsStore((s) => s.selectionToolbar);
  const save = useSettingsStore((s) => s.setSelectionToolbar);

  const cfg = stored ?? RENDERER_DEFAULT;

  const [enabled, setEnabled] = useState(cfg.enabled);
  const [triggerMode, setTriggerMode] = useState<SelectionTriggerMode>(cfg.triggerMode);
  const [compact, setCompact] = useState(cfg.compact);
  const [followToolbar, setFollowToolbar] = useState(cfg.followToolbar);
  const [rememberSize, setRememberSize] = useState(cfg.rememberSize);
  const [autoClose, setAutoClose] = useState(cfg.autoClose);
  const [alwaysOnTop, setAlwaysOnTop] = useState(cfg.alwaysOnTop);
  const [opacity, setOpacity] = useState(cfg.opacity);
  const [actions, setActions] = useState<SelectionAction[]>(cfg.actions);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(cfg.searchEngine ?? 'google');
  const [globalMode, setGlobalMode] = useState<GlobalSelectionMode>(cfg.globalMode ?? 'off');
  const [globalShortcut, setGlobalShortcut] = useState(cfg.globalShortcut ?? 'Alt+W');

  useEffect(() => {
    const c = stored ?? RENDERER_DEFAULT;
    setEnabled(c.enabled);
    setTriggerMode(c.triggerMode);
    setCompact(c.compact);
    setFollowToolbar(c.followToolbar);
    setRememberSize(c.rememberSize);
    setAutoClose(c.autoClose);
    setAlwaysOnTop(c.alwaysOnTop);
    setOpacity(c.opacity);
    setActions(c.actions);
    setSearchEngine(c.searchEngine ?? 'google');
    setGlobalMode(c.globalMode ?? 'off');
    setGlobalShortcut(c.globalShortcut ?? 'Alt+W');
  }, [stored]);

  const persist = (patch: Partial<SelectionToolbarConfig>) => {
    const next: SelectionToolbarConfig = {
      enabled, triggerMode, compact, followToolbar, rememberSize,
      autoClose, alwaysOnTop, opacity, actions,
      searchEngine, globalMode, globalShortcut, ...patch,
    };
    void save(next);
  };

  const toggleEnabled = (v: boolean) => { setEnabled(v); persist({ enabled: v }); };
  const changeTrigger = (v: SelectionTriggerMode) => { setTriggerMode(v); persist({ triggerMode: v }); };
  const toggleCompact = (v: boolean) => { setCompact(v); persist({ compact: v }); };
  const toggleFollowToolbar = (v: boolean) => { setFollowToolbar(v); persist({ followToolbar: v }); };
  const toggleRememberSize = (v: boolean) => { setRememberSize(v); persist({ rememberSize: v }); };
  const toggleAutoClose = (v: boolean) => { setAutoClose(v); persist({ autoClose: v }); };
  const toggleAlwaysOnTop = (v: boolean) => { setAlwaysOnTop(v); persist({ alwaysOnTop: v }); };
  const changeOpacity = (v: number) => { setOpacity(v); persist({ opacity: v }); };
  const changeSearchEngine = (v: SearchEngine) => { setSearchEngine(v); persist({ searchEngine: v }); };
  const changeGlobalMode = (v: GlobalSelectionMode) => { setGlobalMode(v); persist({ globalMode: v }); };
  const saveGlobalShortcut = (v: string) => { setGlobalShortcut(v); persist({ globalShortcut: v }); };

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
        {/* Enable */}
        <section className="rounded-xl border border-black/5 bg-surface-muted p-5">
          <ToggleRow label="启用" checked={enabled} onChange={toggleEnabled} />
        </section>

        {/* Toolbar section */}
        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-5">
          <h3 className="text-sm font-semibold text-ink">工具栏</h3>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm text-ink">取词方式</span>
                <InfoIcon title="划词后，触发取词并显示工具栏的方式" />
              </div>
              <SegmentedControl
                value={triggerMode}
                options={[
                  { value: 'select', label: '划词' },
                  { value: 'ctrl', label: 'Ctrl 键' },
                  { value: 'shortcut', label: '快捷键' },
                ]}
                onChange={changeTrigger}
              />
            </div>
            <p className="text-xs text-ink-subtle">
              {triggerMode === 'select' && '划词后，触发取词并显示工具栏的方式'}
              {triggerMode === 'ctrl' && '按住 Ctrl 键划词，触发取词并显示工具栏'}
              {triggerMode === 'shortcut' && '选中文本后按 Alt+C，显示工具栏'}
            </p>
          </div>

          <ToggleRow
            label="紧凑模式"
            description="紧凑模式下，只显示图标，不显示文字"
            checked={compact}
            onChange={toggleCompact}
          />
        </section>

        {/* Window section */}
        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-5">
          <h3 className="text-sm font-semibold text-ink">功能窗口</h3>

          <ToggleRow
            label="跟随工具栏"
            description="工具栏位置将跟随选中位置显示，禁用则始终居中显示"
            checked={followToolbar}
            onChange={toggleFollowToolbar}
          />
          <ToggleRow
            label="记住大小"
            description="应用运行期间，窗口会按上次调整的大小显示"
            checked={rememberSize}
            onChange={toggleRememberSize}
          />
          <ToggleRow
            label="自动关闭"
            description="当取消选中文本时，将自动关闭工具栏"
            checked={autoClose}
            onChange={toggleAutoClose}
          />
          <ToggleRow
            label="自动置顶"
            description="默认将工具栏置于顶部"
            checked={alwaysOnTop}
            onChange={toggleAlwaysOnTop}
          />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm text-ink">透明度</span>
                <p className="text-xs text-ink-subtle mt-0.5">设置工具栏的默认透明度，100% 为完全不透明</p>
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

        {/* Global detection section */}
        <section className="rounded-xl border border-black/5 bg-surface-muted p-5 space-y-5">
          <h3 className="text-sm font-semibold text-ink">全局划词</h3>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">全局模式</span>
              <SegmentedControl
                value={globalMode}
                options={[
                  { value: 'off', label: '关闭' },
                  { value: 'auto', label: '自动' },
                  { value: 'shortcut', label: '快捷键' },
                ]}
                onChange={changeGlobalMode}
              />
            </div>
            <p className="text-xs text-ink-subtle">
              {globalMode === 'off' && '仅在应用内部有效'}
              {globalMode === 'auto' && '监听全局划词，在任意应用中划词后自动弹出工具栏'}
              {globalMode === 'shortcut' && '按下快捷键后获取选中文本并弹出工具栏'}
            </p>
          </div>

          {globalMode === 'shortcut' && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm text-ink">快捷键</span>
                <p className="text-xs text-ink-subtle mt-0.5">例如 Alt+W、Ctrl+Shift+Z</p>
              </div>
              <input
                type="text"
                value={globalShortcut}
                onChange={(e) => setGlobalShortcut(e.target.value)}
                onBlur={(e) => saveGlobalShortcut(e.target.value.trim())}
                placeholder="Alt+W"
                className="h-7 w-32 rounded-md border border-black/10 bg-surface px-2 text-xs text-ink focus:border-accent/40 focus:outline-none"
              />
            </div>
          )}
        </section>

        {/* Search engine section */}
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

        {/* Actions section */}
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

function InfoIcon({ title }: { title: string }) {
  return (
    <span title={title} className="inline-flex cursor-help text-ink-subtle">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="6.5" r="5.5" />
        <path d="M6.5 9V6.5M6.5 4.5v.1" />
      </svg>
    </span>
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
