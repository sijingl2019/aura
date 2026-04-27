import { useEffect, useState, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { ProviderList } from './ProviderList';
import { ProviderDetail } from './ProviderDetail';
import { DefaultModelSection } from './DefaultModelSection';
import { KnowledgeSection } from './KnowledgeSection';
import { SelectionSection } from './SelectionSection';
import { KeyboardShortcutsSection } from './KeyboardShortcutsSection';

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const section = useUiStore((s) => s.settingsSection);
  const openSettings = useUiStore((s) => s.openSettings);
  const close = useUiStore((s) => s.closeSettings);
  const load = useSettingsStore((s) => s.load);
  const loaded = useSettingsStore((s) => s.loaded);
  const providers = useSettingsStore((s) => s.providers);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && !loaded) void load();
  }, [open, loaded, load]);

  useEffect(() => {
    if (!open) return;
    if (!selectedId && providers.length > 0) {
      setSelectedId(providers[0].id);
    }
  }, [open, selectedId, providers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative flex h-[82vh] max-h-[760px] w-[92vw] max-w-[1180px] overflow-hidden rounded-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="flex w-[56px] shrink-0 flex-col items-center gap-1 border-r border-black/5 bg-surface-muted py-3">
          <SidebarItem
            label="模型服务"
            active={section === 'providers'}
            onClick={() => openSettings('providers')}
          >
            <ModelIcon />
          </SidebarItem>
          <SidebarItem
            label="默认模型"
            active={section === 'default-model'}
            onClick={() => openSettings('default-model')}
          >
            <BubbleIcon />
          </SidebarItem>
          <SidebarItem
            label="知识库"
            active={section === 'knowledge'}
            onClick={() => openSettings('knowledge')}
          >
            <DatabaseIcon />
          </SidebarItem>
          <SidebarItem
            label="划词助手"
            active={section === 'selection'}
            onClick={() => openSettings('selection')}
          >
            <SelectionIcon />
          </SidebarItem>
          <SidebarItem
            label="快捷键"
            active={section === 'shortcuts'}
            onClick={() => openSettings('shortcuts')}
          >
            <KeyboardIcon />
          </SidebarItem>
        </aside>

        {section === 'providers' && (
          <>
            <ProviderList selectedId={selectedId} onSelect={setSelectedId} />
            <ProviderDetail providerId={selectedId} />
          </>
        )}
        {section === 'default-model' && <DefaultModelSection />}
        {section === 'knowledge' && <KnowledgeSection />}
        {section === 'selection' && <SelectionSection />}
        {section === 'shortcuts' && <KeyboardShortcutsSection />}

        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          title="关闭"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function SidebarItem({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ' +
        (active
          ? 'bg-surface text-ink shadow-sm'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')
      }
    >
      {children}
    </button>
  );
}

function ModelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5h12M3 9h12M3 12.5h12" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5a2 2 0 012-2h8a2 2 0 012 2v5a2 2 0 01-2 2H8l-3 2.5V12H5a2 2 0 01-2-2z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="9" cy="4.5" rx="6" ry="2" />
      <path d="M3 4.5v4c0 1.1 2.69 2 6 2s6-.9 6-2v-4" />
      <path d="M3 8.5v4c0 1.1 2.69 2 6 2s6-.9 6-2v-4" />
    </svg>
  );
}

function SelectionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="9" height="2.5" rx="1" fill="currentColor" stroke="none" opacity="0.35" />
      <path d="M2 10h14M2 13.5h9" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="9" rx="1.5" />
      <path d="M5 8h1M8.5 8h1M12 8h1M5 11h8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}
