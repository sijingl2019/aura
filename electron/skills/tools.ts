import { fail, ok } from '../tools/types';
import type { Tool } from '../tools/types';
import type { SkillStore } from './loader';
import { createSkill, updateSkill } from './manager';

export function createSkillsTools(store: SkillStore): Tool[] {
  return [
    skillsListTool(store),
    skillsReadTool(store),
    skillsCreateTool(store),
    skillsUpdateTool(store),
  ];
}

function skillsListTool(store: SkillStore): Tool {
  return {
    name: 'skills_list',
    description:
      'List all available skills with id, name, and description. Call this first to discover skills before reading or applying them.',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const skills = store.list();
      if (skills.length === 0) {
        return ok('暂无技能。可使用 skills_create 创建一个。');
      }
      const lines = skills.map(
        (s) => `- **${s.name}** (id: \`${s.id}\`): ${s.description}`,
      );
      return ok(`共 ${skills.length} 个技能：\n${lines.join('\n')}`);
    },
  };
}

function skillsReadTool(store: SkillStore): Tool {
  return {
    name: 'skills_read',
    description: "Read the full body/instructions of a skill by its id. The body is a system-prompt snippet you can follow in the current conversation.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The skill id (from skills_list).' },
      },
      required: ['id'],
    },
    async execute(input) {
      const { id } = (input as { id?: string }) ?? {};
      if (!id?.trim()) return fail('missing "id"');
      const skill = store.get(id.trim());
      if (!skill) return fail(`技能 "${id}" 不存在。使用 skills_list 查看可用技能。`);
      return ok(`# ${skill.name}\n\n**描述：** ${skill.description}\n\n---\n\n${skill.body}`);
    },
  };
}

function skillsCreateTool(store: SkillStore): Tool {
  return {
    name: 'skills_create',
    description:
      'Create a new skill and save it to disk. The skill body is a system-prompt snippet that defines specialized behavior. Returns the new skill id.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short display name (e.g. "代码审查专家").' },
        description: { type: 'string', description: 'One-line description of what the skill does.' },
        body: {
          type: 'string',
          description: 'The system-prompt instructions that define this skill\'s behavior. Write in first person ("你是...") for best results.',
        },
      },
      required: ['name', 'description', 'body'],
    },
    async execute(input) {
      const { name, description, body } =
        (input as { name?: string; description?: string; body?: string }) ?? {};
      if (!name?.trim()) return fail('missing "name"');
      if (!description?.trim()) return fail('missing "description"');
      if (!body?.trim()) return fail('missing "body"');
      try {
        const skill = await createSkill(name.trim(), description.trim(), body.trim());
        await store.reload();
        return ok(`技能 "${skill.name}" 创建成功（id: \`${skill.id}\`）。`);
      } catch (e) {
        return fail(`创建失败: ${(e as Error).message}`);
      }
    },
  };
}

function skillsUpdateTool(store: SkillStore): Tool {
  return {
    name: 'skills_update',
    description:
      "Update an existing skill's name, description, or body. Omit any field to keep its current value.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The skill id to update.' },
        name: { type: 'string', description: 'New display name (optional).' },
        description: { type: 'string', description: 'New one-line description (optional).' },
        body: { type: 'string', description: 'New system-prompt instructions (optional).' },
      },
      required: ['id'],
    },
    async execute(input) {
      const { id, name, description, body } =
        (input as { id?: string; name?: string; description?: string; body?: string }) ?? {};
      if (!id?.trim()) return fail('missing "id"');
      const existing = store.get(id.trim());
      if (!existing) return fail(`技能 "${id}" 不存在。使用 skills_list 查看可用技能。`);
      try {
        const updated = await updateSkill(
          id.trim(),
          name?.trim() || existing.name,
          description?.trim() || existing.description,
          body?.trim() || existing.body,
        );
        await store.reload();
        return ok(`技能 "${updated.name}" 更新成功。`);
      } catch (e) {
        return fail(`更新失败: ${(e as Error).message}`);
      }
    },
  };
}
