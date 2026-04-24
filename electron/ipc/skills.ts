import { ipcMain } from 'electron';
import type { SkillListItem } from '@shared/types';
import type { SkillStore } from '../skills/loader';

export function registerSkillsIpc(skills: SkillStore): void {
  ipcMain.handle('skills:list', (): SkillListItem[] =>
    skills.list().map((s) => ({ id: s.id, name: s.name, description: s.description })),
  );

  ipcMain.handle('skills:get', (_e, params: { id: string }) => skills.get(params.id) ?? null);
}
