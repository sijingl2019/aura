import { useEffect, useState, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { ProviderList } from './ProviderList';
import { ProviderDetail } from './ProviderDetail';
import { DefaultModelSection } from './DefaultModelSection';
import { KnowledgeSection } from './KnowledgeSection';
import { SelectionSection } from './SelectionSection';
import { SkillsSection } from './SkillsSection';
import { McpSection } from './McpSection';
import { GeneralSection } from './GeneralSection';
import { useT } from '@/i18n';

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const section = useUiStore((s) => s.settingsSection);
  const openSettings = useUiStore((s) => s.openSettings);
  const close = useUiStore((s) => s.closeSettings);
  const load = useSettingsStore((s) => s.load);
  const loaded = useSettingsStore((s) => s.loaded);
  const providers = useSettingsStore((s) => s.providers);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(() =>
    localStorage.getItem('settings-nav-collapsed') !== 'false'
  );

  const toggleNav = () => {
    setNavCollapsed((v) => {
      localStorage.setItem('settings-nav-collapsed', String(!v));
      return !v;
    });
  };

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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const t = useT();

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
        <aside className={`flex shrink-0 flex-col border-r border-black/5 bg-surface-muted py-3 transition-all duration-200 ${navCollapsed ? 'w-[56px] items-center' : 'w-[140px] items-stretch px-2'}`}>
          <div className={`flex flex-1 flex-col gap-1 ${navCollapsed ? 'items-center' : 'items-stretch'}`}>
            <SidebarItem
              label={t.nav.providers}
              active={section === 'providers'}
              collapsed={navCollapsed}
              onClick={() => openSettings('providers')}
            >
              <ModelIcon />
            </SidebarItem>
            <SidebarItem
              label={t.nav.defaultModel}
              active={section === 'default-model'}
              collapsed={navCollapsed}
              onClick={() => openSettings('default-model')}
            >
              <BubbleIcon />
            </SidebarItem>
            <SidebarItem
              label={t.nav.knowledge}
              active={section === 'knowledge'}
              collapsed={navCollapsed}
              onClick={() => openSettings('knowledge')}
            >
              <DatabaseIcon />
            </SidebarItem>
            <SidebarItem
              label={t.nav.selection}
              active={section === 'selection'}
              collapsed={navCollapsed}
              onClick={() => openSettings('selection')}
            >
              <SelectionIcon />
            </SidebarItem>
            <SidebarItem
              label={t.nav.skills}
              active={section === 'skills'}
              collapsed={navCollapsed}
              onClick={() => openSettings('skills')}
            >
              <SkillIcon />
            </SidebarItem>
            <SidebarItem
              label={t.nav.mcp}
              active={section === 'mcp'}
              collapsed={navCollapsed}
              onClick={() => openSettings('mcp')}
            >
              <McpIcon />
            </SidebarItem>
            <SidebarItem
              label={t.nav.general}
              active={section === 'general'}
              collapsed={navCollapsed}
              onClick={() => openSettings('general')}
            >
              <GeneralIcon />
            </SidebarItem>
          </div>

          <button
            type="button"
            title={navCollapsed ? t.common.expand : t.common.collapse}
            onClick={toggleNav}
            className={`mt-1 flex items-center justify-center rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink ${navCollapsed ? 'h-9 w-9' : 'gap-2 px-2 py-1.5'}`}
          >
            <NavToggleIcon collapsed={navCollapsed} />
            {!navCollapsed && <span className="text-xs">{t.common.collapse}</span>}
          </button>
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
        {section === 'skills' && <SkillsSection />}
        {section === 'mcp' && <McpSection />}
        {section === 'general' && <GeneralSection />}

        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          title={t.common.close}
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
  collapsed,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={
        'flex items-center rounded-lg transition-colors ' +
        (collapsed ? 'h-9 w-9 justify-center ' : 'gap-2.5 px-2 py-2 ') +
        (active
          ? 'bg-surface text-ink shadow-sm'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')
      }
    >
      <span className="shrink-0">{children}</span>
      {!collapsed && <span className="truncate text-xs font-medium">{label}</span>}
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

function SkillIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2L12 6H6L9 2Z" />
      <path d="M6 6H3C2.45 6 2 6.45 2 7V15C2 15.55 2.45 16 3 16H15C15.55 16 16 15.55 16 15V7C16 6.45 15.55 6 15 6H12" />
      <path d="M9 10V14" />
      <path d="M7 12H11" />
    </svg>
  );
}

function GeneralIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2" />
      <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4.1 4.1l1.1 1.1M12.8 12.8l1.1 1.1M4.1 13.9l1.1-1.1M12.8 5.2l1.1-1.1" />
    </svg>
  );
}

function McpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="9" rx="1.5" />
      <path d="M5 5V4a2 2 0 014 0v1M9 9v2M6.5 9.5h5" />
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

function NavToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      {collapsed ? <path d="M6.5 3v10" /> : <path d="M9.5 3v10" />}
    </svg>
  );
}
