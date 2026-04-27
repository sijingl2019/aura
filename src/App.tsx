import { useEffect, useMemo, useState } from 'react';
import {
  createHashRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from 'react-router-dom';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ChatRoute } from './routes/ChatRoute';
import { PopupRoute } from './routes/PopupRoute';
import { ToolbarRoute } from './routes/ToolbarRoute';
import { SettingsModal } from './components/Settings/SettingsModal';
import { SearchDialog } from './components/SearchDialog';
import { installLlmEventListener } from './lib/ipc';
import { useUiStore } from './stores/ui';
import { useConversationsStore } from './stores/conversations';
import { useSettingsStore } from './stores/settings';
import { useShortcuts } from './hooks/useShortcuts';
import { QuickQuestionRoute } from './routes/QuickQuestionRoute';

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const openSearch = useUiStore((s) => s.openSearch);
  const openSettings = useUiStore((s) => s.openSettings);
  const createConv = useConversationsStore((s) => s.create);
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const loadShortcuts = useSettingsStore((s) => s.loadShortcuts);

  useEffect(() => {
    const off = installLlmEventListener();
    return off;
  }, []);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  const actions = useMemo(() => ({
    newConversation: async () => {
      const conv = await createConv();
      navigate(`/c/${conv.id}`);
    },
    openSettings: () => openSettings('providers'),
    closeWindow: () => void window.api.window.close(),
    openSearch,
  }), [createConv, navigate, openSettings, openSearch]);

  // Wrap async action to satisfy the sync interface
  const shortcutActions = useMemo(() => ({
    newConversation: () => { void actions.newConversation(); },
    openSettings: actions.openSettings,
    closeWindow: actions.closeWindow,
    openSearch: actions.openSearch,
  }), [actions]);

  useShortcuts(shortcuts, shortcutActions);

  return (
    <div className="flex h-screen w-screen flex-col bg-surface text-ink">
      <TitleBar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenSearch={openSearch}
      />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar onSelect={(id) => navigate(`/c/${id}`)} />}
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <SettingsModal />
      <SearchDialog onNavigate={(id) => navigate(`/c/${id}`)} />
    </div>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <ChatRoute /> },
      { path: 'c/:id', element: <ChatRoute /> },
    ],
  },
  { path: '/popup', element: <PopupRoute /> },
  { path: '/toolbar', element: <ToolbarRoute /> },
  { path: '/quick-question', element: <QuickQuestionRoute /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
