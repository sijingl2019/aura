import { contextBridge, ipcRenderer } from 'electron';

const api = {
  ping: () => ipcRenderer.invoke('app:ping') as Promise<string>,
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<void>,
    close: () => ipcRenderer.invoke('window:close') as Promise<void>,
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    onMaximizedChange: (cb: (maximized: boolean) => void) => {
      const listener = (_: unknown, value: boolean) => cb(value);
      ipcRenderer.on('window:maximized-change', listener);
      return () => ipcRenderer.off('window:maximized-change', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
