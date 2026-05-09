/* eslint-disable react/forbid-dom-props */
import { useRef, useState } from 'react';
import type { AppLanguage, AppTheme, GeneralConfig, ProxyMode } from '@shared/types';
import { useSettingsStore } from '@/stores/settings';
import { useT, useI18n } from '@/i18n';
import { applyTheme } from '@/lib/theme';

const ACCENT_PRESETS = [
  '#22c55e', '#ef4444', '#14b8a6', '#6366f1',
  '#a855f7', '#ec4899', '#3b82f6', '#f59e0b',
  '#7c3aed', '#0ea5e9', '#d97757',
];

export function GeneralSection() {
  const general = useSettingsStore((s) => s.general);
  const setGeneral = useSettingsStore((s) => s.setGeneral);
  const t = useT();

  const [draft, setDraft] = useState<GeneralConfig>(general);
  const [customColor, setCustomColor] = useState(general.accentColor);
  const [avatarInput, setAvatarInput] = useState(general.userAvatar ?? '');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const persist = (patch: Partial<GeneralConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void setGeneral(next);
  };

  return (
    <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden bg-surface">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 min-h-0">

        {/* ── 常规设置 ──────────────────────────────────────── */}
        <Section title={t.general.sectionGeneral}>
          <Row label="我的头像">
            <div className="flex items-center gap-3">
              {/* preview */}
              <div
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent/15 text-base font-medium text-accent overflow-hidden"
                onClick={() => avatarFileRef.current?.click()}
                title="点击上传图片"
              >
                {draft.userAvatar && draft.userAvatar.startsWith('data:') ? (
                  <img src={draft.userAvatar} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  (draft.userAvatar?.trim() || '我').charAt(0)
                )}
              </div>
              {/* text/emoji input */}
              <input
                type="text"
                maxLength={2}
                value={avatarInput}
                placeholder="我"
                onChange={(e) => {
                  setAvatarInput(e.target.value);
                  persist({ userAvatar: e.target.value || undefined });
                }}
                className="h-8 w-16 rounded-md border border-black/10 bg-surface px-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none"
              />
              <span className="text-xs text-ink-subtle">或</span>
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                className="h-8 rounded-md border border-black/10 px-3 text-xs text-ink-muted hover:border-accent/40 hover:text-ink"
              >
                上传图片
              </button>
              {draft.userAvatar && (
                <button
                  type="button"
                  onClick={() => { setAvatarInput(''); persist({ userAvatar: undefined }); }}
                  className="text-xs text-red-400 hover:text-red-500"
                >
                  清除
                </button>
              )}
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result as string;
                    setAvatarInput('');
                    persist({ userAvatar: dataUrl });
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>
          </Row>
          <Row label={t.general.language}>
            <select
              aria-label={t.general.language}
              value={draft.language}
              onChange={(e) => {
                const lang = e.target.value as AppLanguage;
                persist({ language: lang });
                useI18n.getState().setLang(lang);
              }}
              className="h-8 rounded-md border border-black/10 bg-surface px-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none"
            >
              <option value="zh-CN">{t.general.langZhCN}</option>
              <option value="en">{t.general.langEn}</option>
              <option value="zh-TW">{t.general.langZhTW}</option>
            </select>
          </Row>

          <Row label={t.general.proxyMode}>
            <select
              aria-label={t.general.proxyMode}
              value={draft.proxyMode}
              onChange={(e) => persist({ proxyMode: e.target.value as ProxyMode })}
              className="h-8 max-w-[180px] rounded-md border border-black/10 bg-surface px-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none"
            >
              <option value="system">{t.general.proxySystem}</option>
              <option value="none">{t.general.proxyNone}</option>
              <option value="manual">{t.general.proxyManual}</option>
            </select>
          </Row>

          {draft.proxyMode === 'manual' && (
            <div className="flex items-center gap-2 px-4 py-3">
              <input
                type="text"
                value={draft.proxyHost ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, proxyHost: e.target.value }))}
                onBlur={() => persist({})}
                placeholder={t.general.proxyHost}
                className="h-8 flex-1 rounded-md border border-black/10 bg-surface px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
              />
              <span className="text-xs text-ink-subtle">:</span>
              <input
                type="number"
                value={draft.proxyPort ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, proxyPort: Number(e.target.value) || undefined }))}
                onBlur={() => persist({})}
                placeholder={t.general.proxyPort}
                className="h-8 w-20 rounded-md border border-black/10 bg-surface px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
              />
            </div>
          )}

          <Row label={t.general.spellCheck}>
            <div className="flex items-center gap-2">
              <Toggle checked={draft.spellCheck} onChange={(v) => persist({ spellCheck: v })} accentColor={draft.accentColor} />
              <span className="text-[11px] text-ink-subtle">{t.general.spellCheckNote}</span>
            </div>
          </Row>
        </Section>

        {/* ── 显示设置 ──────────────────────────────────────── */}
        <Section title={t.general.sectionDisplay}>
          {/* Theme */}
          <Row label={t.general.theme}>
            <div className="flex overflow-hidden rounded-md border border-black/10">
              {(['light', 'system', 'dark'] as AppTheme[]).map((v) => {
                const label = v === 'light' ? t.general.themeLight : v === 'dark' ? t.general.themeDark : t.general.themeSystem;
                const icon = v === 'light' ? '☀️' : v === 'dark' ? '🌙' : '🖥️';
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { persist({ theme: v }); applyTheme(v, draft.accentColor, draft.transparentWindow); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                      draft.theme === v
                        ? 'bg-accent text-white'
                        : 'bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </Row>

          {/* Accent color */}
          <Row label={t.general.accentColor}>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((color) => (
                <Swatch
                  key={color}
                  color={color}
                  active={draft.accentColor === color}
                  onPick={() => { persist({ accentColor: color }); setCustomColor(color); applyTheme(draft.theme, color, draft.transparentWindow); }}
                />
              ))}
              {/* Custom hex + native color picker */}
              <div className="flex items-center gap-1 rounded-md border border-black/10 bg-surface pl-1.5">
                <ColorDot color={customColor} />
                <input
                  type="text"
                  value={customColor}
                  aria-label="Hex color value"
                  maxLength={7}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                      persist({ accentColor: e.target.value });
                      applyTheme(draft.theme, e.target.value, draft.transparentWindow);
                    }
                  }}
                  className="w-16 bg-transparent py-1 text-xs text-ink focus:outline-none"
                />
                <label className="flex cursor-pointer items-center pr-1" title={t.general.accentColor}>
                  <span className="text-xs text-ink-subtle leading-none">⌄</span>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => { setCustomColor(e.target.value); persist({ accentColor: e.target.value }); applyTheme(draft.theme, e.target.value, draft.transparentWindow); }}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </Row>

          {/* Transparent window */}
          <Row label={t.general.transparentWindow}>
            <div className="flex items-center gap-2">
              <Toggle checked={draft.transparentWindow} onChange={(v) => { persist({ transparentWindow: v }); applyTheme(draft.theme, draft.accentColor, v); }} accentColor={draft.accentColor} />
              <span className="text-[11px] text-ink-subtle">{t.general.transparentWindowNote}</span>
            </div>
          </Row>
        </Section>

        {/* ── 启动 ──────────────────────────────────────────── */}
        <Section title={t.general.sectionStartup}>
          <Row label={t.general.launchAtStartup}>
            <Toggle checked={draft.launchAtStartup} onChange={(v) => persist({ launchAtStartup: v })} accentColor={draft.accentColor} />
          </Row>
        </Section>

        {/* ── 托盘 ──────────────────────────────────────────── */}
        <Section title={t.general.sectionTray}>
          <Row label={t.general.showTrayIcon}>
            <Toggle checked={draft.showTrayIcon} onChange={(v) => persist({ showTrayIcon: v })} accentColor={draft.accentColor} />
          </Row>
        </Section>
      </div>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-xl border border-black/5 bg-surface">
      <div className="border-b border-black/5 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span className="shrink-0 text-sm text-ink">{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  accentColor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  accentColor: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={checked ? 'On' : 'Off'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={checked ? { backgroundColor: accentColor } : undefined}
      className={`relative h-[22px] w-[40px] rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
        checked ? '' : 'bg-black/15'
      }`}
    >
      <span
        className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Swatch({ color, active, onPick }: { color: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      title={color}
      onClick={onPick}
      className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${active ? 'ring-2 ring-offset-1' : ''}`}
      style={{ backgroundColor: color, ringColor: active ? color : undefined } as React.CSSProperties}
    />
  );
}

function ColorDot({ color }: { color: string }) {
  return <div className="h-4 w-4 rounded" style={{ backgroundColor: color } as React.CSSProperties} />;
}
