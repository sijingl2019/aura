import { ipcMain } from 'electron';
import type { SkillListItem, Skill } from '@shared/types';
import type { SkillStore } from '../skills/loader';
import { createSkill, updateSkill, deleteSkill } from '../skills/manager';

export function registerSkillsIpc(skills: SkillStore): void {
  ipcMain.handle('skills:list', (): SkillListItem[] =>
    skills.list().map((s) => ({ id: s.id, name: s.name, description: s.description })),
  );

  ipcMain.handle('skills:get', (_e, params: { id: string }) => skills.get(params.id) ?? null);

  ipcMain.handle(
    'skills:create',
    async (
      _e,
      params: { name: string; description: string; body: string }
    ): Promise<Skill> => {
      const skill = await createSkill(params.name, params.description, params.body);
      await skills.reload();
      return skill;
    }
  );

  ipcMain.handle(
    'skills:update',
    async (
      _e,
      params: { id: string; name: string; description: string; body: string }
    ): Promise<Skill> => {
      const skill = await updateSkill(
        params.id,
        params.name,
        params.description,
        params.body
      );
      await skills.reload();
      return skill;
    }
  );

  ipcMain.handle('skills:delete', async (_e, params: { id: string }): Promise<void> => {
    await deleteSkill(params.id);
    await skills.reload();
  });
}
