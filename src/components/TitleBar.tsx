import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppMenu } from './AppMenu';

interface TitleBarProps {
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
}

const isMac = /Mac/.test(navigator.platform);

export function TitleBar({ onToggleSidebar, onOpenSearch }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized);
    const off = window.api.window.onMaximizedChange(setMaximized);
    return off;
  }, []);

  const iconButtons = (
    <>
      <IconButton
        ref={menuButtonRef}
        title="Menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <MenuIcon />
      </IconButton>
      <AppMenu
        anchor={menuButtonRef.current}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <IconButton title="Toggle sidebar" onClick={onToggleSidebar}>
        <SidebarIcon />
      </IconButton>
      <IconButton title="Search" onClick={onOpenSearch}>
        <SearchIcon />
      </IconButton>
      <IconButton title="Back" disabled>
        <ArrowLeftIcon />
      </IconButton>
      <IconButton title="Forward" disabled>
        <ArrowRightIcon />
      </IconButton>
    </>
  );

  return (
    <header className="drag-region flex h-9 shrink-0 select-none items-center border-b border-black/5 bg-surface">
      {isMac ? (
        <>
          <div className="flex-1" />
          <div className="no-drag-region flex items-center pr-1">
            {iconButtons}
          </div>
        </>
      ) : (
        <>
          <div className="no-drag-region flex items-center pl-2">
            {iconButtons}
          </div>
          <div className="flex-1" />
          <div className="no-drag-region flex items-center">
            <WindowButton title="Minimize" onClick={() => window.api.window.minimize()}>
              <MinimizeIcon />
            </WindowButton>
            <WindowButton
              title={maximized ? 'Restore' : 'Maximize'}
              onClick={() => window.api.window.toggleMaximize()}
            >
              {maximized ? <RestoreIcon /> : <MaximizeIcon />}
            </WindowButton>
            <WindowButton title="Close" danger onClick={() => window.api.window.close()}>
              <CloseIcon />
            </WindowButton>
          </div>
        </>
      )}
    </header>
  );
}

interface ButtonProps {
  title: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ title, children, onClick, disabled }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        title={title}
        onClick={onClick}
        disabled={disabled}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:text-ink-subtle/60"
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';

function WindowButton({
  title,
  children,
  onClick,
  danger,
}: ButtonProps & { danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        'inline-flex h-9 w-11 items-center justify-center text-ink-muted transition-colors ' +
        (danger
          ? 'hover:bg-red-500 hover:text-white'
          : 'hover:bg-surface-sunken hover:text-ink')
      }
    >
      {children}
    </button>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M6.5 3v10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M2 6h8" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="2" y="2" width="8" height="8" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="2" y="4" width="6" height="6" />
      <path d="M4 4V2h6v6H8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
    </svg>
  );
}
