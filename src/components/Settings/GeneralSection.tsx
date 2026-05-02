/* eslint-disable react/forbid-dom-props */
import { useState } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [customColor, setCustomColor] = useState(general.accentColor);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(general);

  const update = (patch: Partial<GeneralConfig>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setGeneral(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">

        {/* ── 常规设置 ──────────────────────────────────────── */}
        <Section title={t.general.sectionGeneral}>
          <Row label={t.general.language}>
            <select
              aria-label={t.general.language}
              value={draft.language}
              onChange={(e) => {
                const lang = e.target.value as AppLanguage;
                update({ language: lang });
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
              onChange={(e) => update({ proxyMode: e.target.value as ProxyMode })}
              className="h-8 max-w-[180px] rounded-md border border-black/10 bg-surface px-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none"
            >
              <option value="system">{t.general.proxySystem}</option>
              <option value="none">{t.general.proxyNone}</option>
              <option value="manual">{t.general.proxyManual}</option>
            </select>
          </Row>

          {draft.proxyMode === 'manual' && (
            <div className="flex items-center gap-2 px-4 pb-3">
              <input
                type="text"
                value={draft.proxyHost ?? ''}
                onChange={(e) => update({ proxyHost: e.target.value })}
                placeholder={t.general.proxyHost}
                className="h-8 flex-1 rounded-md border border-black/10 bg-surface px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
              />
              <span className="text-xs text-ink-subtle">:</span>
              <input
                type="number"
                value={draft.proxyPort ?? ''}
                onChange={(e) => update({ proxyPort: Number(e.target.value) || undefined })}
                placeholder={t.general.proxyPort}
                className="h-8 w-20 rounded-md border border-black/10 bg-surface px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
              />
            </div>
          )}

          <Row label={t.general.spellCheck}>
            <div className="flex items-center gap-2">
              <Toggle checked={draft.spellCheck} onChange={(v) => update({ spellCheck: v })} accentColor={draft.accentColor} />
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
                    onClick={() => { update({ theme: v }); applyTheme(v, draft.accentColor); }}
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
                  onPick={() => { update({ accentColor: color }); setCustomColor(color); applyTheme(draft.theme, color); }}
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
                      update({ accentColor: e.target.value });
                      applyTheme(draft.theme, e.target.value);
                    }
                  }}
                  className="w-16 bg-transparent py-1 text-xs text-ink focus:outline-none"
                />
                <label className="flex cursor-pointer items-center pr-1" title={t.general.accentColor}>
                  <span className="text-xs text-ink-subtle leading-none">⌄</span>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => { setCustomColor(e.target.value); update({ accentColor: e.target.value }); applyTheme(draft.theme, e.target.value); }}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </Row>

          {/* Transparent window */}
          <Row label={t.general.transparentWindow}>
            <div className="flex items-center gap-2">
              <Toggle checked={draft.transparentWindow} onChange={(v) => update({ transparentWindow: v })} accentColor={draft.accentColor} />
              <span className="text-[11px] text-ink-subtle">{t.general.transparentWindowNote}</span>
            </div>
          </Row>
        </Section>

        {/* ── 启动 ──────────────────────────────────────────── */}
        <Section title={t.general.sectionStartup}>
          <Row label={t.general.launchAtStartup}>
            <Toggle checked={draft.launchAtStartup} onChange={(v) => update({ launchAtStartup: v })} accentColor={draft.accentColor} />
          </Row>
          <Row label={t.general.minimizeToTray}>
            <Toggle checked={draft.minimizeToTrayOnStartup} onChange={(v) => update({ minimizeToTrayOnStartup: v })} accentColor={draft.accentColor} />
          </Row>
        </Section>

        {/* ── 托盘 ──────────────────────────────────────────── */}
        <Section title={t.general.sectionTray}>
          <Row label={t.general.showTrayIcon}>
            <Toggle checked={draft.showTrayIcon} onChange={(v) => update({ showTrayIcon: v })} accentColor={draft.accentColor} />
          </Row>
          <Row label={t.general.minimizeToTrayOnClose}>
            <Toggle
              checked={draft.minimizeToTrayOnClose}
              onChange={(v) => update({ minimizeToTrayOnClose: v })}
              disabled={!draft.showTrayIcon}
              accentColor={draft.accentColor}
            />
          </Row>
        </Section>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      {isDirty && (
        <div className="flex justify-end border-t border-black/5 px-6 py-3">
          <button
            type="button"
            onClick={() => {
              setDraft(general);
              setCustomColor(general.accentColor);
              useI18n.getState().setLang(general.language);
              applyTheme(general.theme, general.accentColor);
            }}
            className="mr-2 h-8 rounded-md border border-black/10 px-4 text-sm text-ink-muted hover:text-ink"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-8 rounded-md bg-accent px-4 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {t.common.save}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-surface">
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
        className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
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
