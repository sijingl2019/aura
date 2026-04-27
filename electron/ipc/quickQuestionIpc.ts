import { BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { expandQuickQuestionWindow, hideQuickQuestionWindow, setIgnoreBlur } from '../windows/quickQuestionWindow';

export function registerQuickQuestionIpc(): void {
  ipcMain.handle('quickQuestion:close', () => {
    hideQuickQuestionWindow();
  });

  ipcMain.handle('quickQuestion:expand', () => {
    expandQuickQuestionWindow();
  });

  ipcMain.handle('quickQuestion:openAttachMenu', async (e) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    if (!window) return [];

    setIgnoreBlur(true);

    return new Promise<string[]>((resolve) => {
      let chose = false;
      const cleanup = () => setTimeout(() => setIgnoreBlur(false), 120);

      const handlePick = async (properties: Electron.OpenDialogOptions['properties']) => {
        chose = true;
        try {
          const result = await dialog.showOpenDialog(window, { properties });
          resolve(result.canceled ? [] : result.filePaths);
        } catch {
          resolve([]);
        } finally {
          cleanup();
        }
      };

      const menu = Menu.buildFromTemplate([
        { label: '添加文件',   click: () => void handlePick(['openFile', 'multiSelections']) },
        { label: '添加文件夹', click: () => void handlePick(['openDirectory']) },
      ]);

      menu.popup({
        window,
        callback: () => {
          // Menu closed without picking — click handlers fire synchronously, so `chose`
          // is already set if an item was selected.
          if (!chose) {
            resolve([]);
            cleanup();
          }
        },
      });
    });
  });
}
