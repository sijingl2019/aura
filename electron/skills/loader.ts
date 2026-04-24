import fs from 'node:fs/promises';
import path from 'node:path';
import type { Skill } from '@shared/types';

interface ParsedFrontmatter {
  data: Record<string, string>;
  body: string;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const normalized = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { data: {}, body: normalized };
  const header = normalized.slice(4, end);
  const body = normalized.slice(end + 5);
  const data: Record<string, string> = {};
  for (const line of header.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body };
}

async function loadFromDir(dir: string): Promise<Skill[]> {
  const out: Skill[] = [];
  let entries: Array<import('node:fs').Dirent>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(dir, entry.name);
    const mdPath = path.join(skillDir, 'SKILL.md');
    try {
      const raw = await fs.readFile(mdPath, 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const name = data.name?.trim();
      const description = data.description?.trim();
      if (!name || !description) {
        console.warn(`[skills] skipping ${skillDir}: missing name/description in frontmatter`);
        continue;
      }
      out.push({
        id: entry.name,
        name,
        description,
        body: body.trim(),
        dir: skillDir,
      });
    } catch {
      /* no SKILL.md — skip */
    }
  }
  return out;
}

export async function loadSkills(dirs: string[]): Promise<Skill[]> {
  const seen = new Map<string, Skill>();
  for (const dir of dirs) {
    const list = await loadFromDir(dir);
    for (const s of list) if (!seen.has(s.id)) seen.set(s.id, s);
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export class SkillStore {
  private skills: Skill[] = [];

  constructor(private dirs: string[]) {}

  async reload(): Promise<void> {
    this.skills = await loadSkills(this.dirs);
  }

  list(): Skill[] {
    return this.skills;
  }

  get(id: string): Skill | undefined {
    return this.skills.find((s) => s.id === id);
  }
}
