import { useEffect, useState } from 'react';
import {
  createHashRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from 'react-router-dom';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ChatRoute } from './routes/ChatRoute';
import { SettingsModal } from './components/Settings/SettingsModal';
import { installLlmEventListener } from './lib/ipc';

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const off = installLlmEventListener();
    return off;
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-surface text-ink">
      <TitleBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar onSelect={(id) => navigate(`/c/${id}`)} />}
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <SettingsModal />
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
]);

export default function App() {
  return <RouterProvider router={router} />;
}
