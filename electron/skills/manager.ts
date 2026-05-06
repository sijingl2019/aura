import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Skill } from '@shared/types';

const SKILLS_DIR = path.join(os.homedir(), '.qiko-aura', 'skills');

async function ensureSkillsDir(): Promise<void> {
  try {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
  } catch (err) {
    console.error('[skills] failed to create skills directory:', err);
    throw new Error('Failed to create skills directory');
  }
}

function createFrontmatter(name: string, description: string): string {
  return `---
name: "${name.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
---

`;
}

function parseSkillId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
}

export async function createSkill(
  name: string,
  description: string,
  body: string
): Promise<Skill> {
  await ensureSkillsDir();

  let skillId = parseSkillId(name);
  let skillDir = path.join(SKILLS_DIR, skillId);
  let counter = 1;

  // Handle name collisions
  while (true) {
    try {
      await fs.access(skillDir);
      skillId = `${parseSkillId(name)}-${counter}`;
      skillDir = path.join(SKILLS_DIR, skillId);
      counter++;
    } catch {
      // Directory doesn't exist, we can use this ID
      break;
    }
  }

  try {
    await fs.mkdir(skillDir, { recursive: true });

    const frontmatter = createFrontmatter(name, description);
    const content = frontmatter + (body.trim() || '(No content yet)');

    const mdPath = path.join(skillDir, 'SKILL.md');
    await fs.writeFile(mdPath, content, 'utf8');

    return {
      id: skillId,
      name,
      description,
      body: body.trim(),
      dir: skillDir,
    };
  } catch (err) {
    console.error('[skills] failed to create skill:', err);
    throw new Error('Failed to create skill');
  }
}

export async function updateSkill(
  skillId: string,
  name: string,
  description: string,
  body: string
): Promise<Skill> {
  await ensureSkillsDir();

  const skillDir = path.join(SKILLS_DIR, skillId);

  try {
    // Check if skill exists
    await fs.access(skillDir);
  } catch {
    throw new Error(`Skill "${skillId}" not found`);
  }

  try {
    const frontmatter = createFrontmatter(name, description);
    const content = frontmatter + (body.trim() || '(No content yet)');

    const mdPath = path.join(skillDir, 'SKILL.md');
    await fs.writeFile(mdPath, content, 'utf8');

    return {
      id: skillId,
      name,
      description,
      body: body.trim(),
      dir: skillDir,
    };
  } catch (err) {
    console.error('[skills] failed to update skill:', err);
    throw new Error('Failed to update skill');
  }
}

export async function deleteSkill(skillId: string): Promise<void> {
  const skillDir = path.join(SKILLS_DIR, skillId);

  try {
    // Check if skill exists
    await fs.access(skillDir);
  } catch {
    throw new Error(`Skill "${skillId}" not found`);
  }

  try {
    // Recursively remove the directory
    await fs.rm(skillDir, { recursive: true, force: true });
  } catch (err) {
    console.error('[skills] failed to delete skill:', err);
    throw new Error('Failed to delete skill');
  }
}
