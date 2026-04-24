import { useSettingsStore } from '@/stores/settings';
import { ModelCombobox } from './ModelCombobox';

export function DefaultModelSection() {
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel);

  const handleClear = () => {
    void setDefaultModel(null);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-black/5 px-8 py-5">
        <div className="text-base font-medium text-ink">默认模型</div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <BubbleIcon />
              默认助手模型
            </label>
            {defaultModel && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-ink-subtle hover:text-red-500"
              >
                清除
              </button>
            )}
          </div>
          <ModelCombobox
            value={defaultModel ?? null}
            onChange={(v) => setDefaultModel(v)}
            placeholder="请选择默认模型"
          />
          <p className="mt-2 text-xs text-ink-subtle">
            新建对话默认使用该模型。单次对话可在输入框上方的切换器里临时更换。
          </p>
        </section>
      </div>
    </div>
  );
}

function BubbleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0112 3.5v5A1.5 1.5 0 0110.5 10H6L3 12v-2H3.5A1.5 1.5 0 012 8.5z" />
    </svg>
  );
}
