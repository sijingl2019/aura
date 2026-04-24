import { useEffect, useState, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { ProviderList } from './ProviderList';
import { ProviderDetail } from './ProviderDetail';
import { DefaultModelSection } from './DefaultModelSection';

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
        </aside>

        {section === 'providers' && (
          <>
            <ProviderList selectedId={selectedId} onSelect={setSelectedId} />
            <ProviderDetail providerId={selectedId} />
          </>
        )}
        {section === 'default-model' && <DefaultModelSection />}

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

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}
