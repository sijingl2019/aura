import type { SkillListItem } from '@shared/types';
import { useEffect, useState } from 'react';

// ── Static skill catalogue ────────────────────────────────────────────────────

interface SkillCatalogueItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
  body: string;
}

const SKILL_CATALOGUE: SkillCatalogueItem[] = [
  {
    id: 'code-review',
    name: '代码审查',
    description: '审查代码质量、发现潜在问题并给出改进建议。',
    tags: ['开发', '质量'],
    body: `你是一位经验丰富的代码审查专家。

审查代码时，请关注：
- 代码正确性与逻辑错误
- 性能问题与优化空间
- 安全漏洞（SQL 注入、XSS 等）
- 代码可读性与命名规范
- 边界条件与错误处理

输出格式：
1. 总体评价（1-2 句）
2. 问题列表（按严重程度排序）
3. 改进建议`,
  },
  {
    id: 'translator',
    name: '翻译助手',
    description: '高质量中英互译，保持原文语气和专业术语准确性。',
    tags: ['语言', '翻译'],
    body: `你是一位专业翻译，擅长中英互译。

翻译原则：
- 准确传达原文含义，不遗漏、不添加
- 保持原文语气（正式/口语/技术）
- 专业术语使用行业标准译法
- 遇到歧义时给出多种译法并说明

直接输出译文，无需解释过程。如有歧义，在译文后用括号注明。`,
  },
  {
    id: 'writing-polish',
    name: '文章润色',
    description: '优化文章表达，提升语言流畅度和专业度。',
    tags: ['写作', '编辑'],
    body: `你是一位专业文字编辑，擅长润色中文文章。

润色要求：
- 保持原文核心观点和结构不变
- 改善语言流畅度，消除冗余表达
- 统一语气和文风
- 修正语法和标点错误
- 提升专业度和可读性

输出润色后的完整文本，并在末尾简要说明主要修改点。`,
  },
  {
    id: 'sql-expert',
    name: 'SQL 专家',
    description: '编写和优化 SQL 查询，支持复杂分析和性能调优。',
    tags: ['开发', '数据库'],
    body: `你是一位 SQL 专家，精通各主流数据库（MySQL、PostgreSQL、SQLite、ClickHouse 等）。

协助用户：
- 根据需求编写 SQL 查询
- 优化慢查询（分析执行计划、添加索引建议）
- 解释复杂 SQL 语句
- 数据库设计与范式建议

回答时请注明适用的数据库类型，并对关键语句加以解释。`,
  },
  {
    id: 'product-manager',
    name: '产品经理',
    description: '协助产品需求分析、PRD 撰写和功能设计。',
    tags: ['产品', '设计'],
    body: `你是一位资深产品经理，擅长需求分析和产品设计。

可以协助：
- 梳理和细化需求，识别边界情况
- 撰写 PRD 和功能说明文档
- 用户故事（User Story）拆解
- 功能优先级评估（RICE/MoSCoW）
- 竞品分析和功能对比

输出结构清晰，重点突出，避免无意义的废话。`,
  },
  {
    id: 'english-teacher',
    name: '英语老师',
    description: '纠正英文写作错误，解释语法规则，提升英语表达。',
    tags: ['语言', '教育'],
    body: `你是一位耐心的英语老师，专注于帮助中文母语者提升英语写作。

收到英文文本时：
1. 纠正语法、拼写、标点错误
2. 改善用词和表达地道性
3. 解释主要错误原因（用中文）
4. 提供更自然的替代表达

用鼓励的语气，重点讲解规律性错误，帮助用户举一反三。`,
  },
  {
    id: 'data-analyst',
    name: '数据分析师',
    description: '解读数据、识别趋势，提供数据驱动的洞察和建议。',
    tags: ['数据', '分析'],
    body: `你是一位数据分析师，擅长从数据中提取有价值的洞察。

分析框架：
- 明确分析目标和关键指标
- 描述数据基本统计特征
- 识别趋势、异常和相关性
- 结合业务背景解读数据
- 给出可操作的建议

使用简洁的语言，配合数字和图表说明（如可以），避免过度解读。`,
  },
  {
    id: 'markdown-formatter',
    name: 'Markdown 排版',
    description: '将内容整理为规范、美观的 Markdown 格式文档。',
    tags: ['写作', '工具'],
    body: `你是一位 Markdown 排版专家。

接收任意内容后，输出规范的 Markdown 格式文档：
- 使用合适的标题层级（# ## ###）
- 列表、表格、代码块格式规范
- 重要内容加粗或斜体标注
- 保持段落间距适中
- 代码块标注语言类型

只输出 Markdown 文本，不添加额外说明。`,
  },
];

// ── Edit dialog ───────────────────────────────────────────────────────────────

interface EditDialogProps {
  initial?: { name: string; description: string; body: string };
  onSave: (data: { name: string; description: string; body: string }) => void;
  onClose: () => void;
  isNew: boolean;
}

function EditDialog({ initial, onSave, onClose, isNew }: EditDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [body, setBody] = useState(initial?.body ?? '');

  const canSave = name.trim().length > 0 && description.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[80vh] flex flex-col rounded-xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-ink">
          {isNew ? '新建 Skill' : '编辑 Skill'}
        </h2>

        <div className="flex-1 overflow-y-auto space-y-3">
          <Field label="名称">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：代码审查、翻译助手"
              className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
            />
          </Field>

          <Field label="描述">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述这个 Skill 的用途"
              className="h-9 w-full rounded-md border border-black/10 bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
            />
          </Field>

          <Field label="系统提示词">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`你是一个...\n\n当用户...时，你要...\n\n输出格式：\n- 要点1\n- 要点2`}
              rows={10}
              className="w-full rounded-md border border-black/10 bg-surface px-3 py-2 text-sm font-mono text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none resize-none"
            />
          </Field>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-black/10 px-4 text-sm text-ink-muted hover:text-ink"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() =>
              canSave && onSave({ name: name.trim(), description: description.trim(), body })
            }
            disabled={!canSave}
            className="h-8 rounded-md bg-accent px-4 text-sm text-white hover:opacity-90 disabled:opacity-40"
          >
            {isNew ? '创建' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function SkillsSection() {
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
    description: string;
    body: string;
  } | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');

  useEffect(() => {
    loadSkills();
    return window.api.skills.onUpdated(loadSkills);
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await window.api.skills.list();
      setSkills(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = (item: SkillCatalogueItem) => {
    setEditTarget({ id: item.id, name: item.name, description: item.description, body: item.body });
    setShowAddDialog(true);
  };

  const handleEdit = async (id: string) => {
    try {
      const skill = await window.api.skills.get({ id });
      if (skill) {
        setEditTarget({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          body: skill.body,
        });
        setShowAddDialog(true);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除 Skill「${name}」吗？`)) return;
    try {
      await window.api.skills.delete({ id });
      await loadSkills();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSave = async (data: { name: string; description: string; body: string }) => {
    try {
      if (editTarget?.id && skills.some((s) => s.id === editTarget.id)) {
        await window.api.skills.update({ id: editTarget.id, ...data });
      } else {
        await window.api.skills.create(data);
      }
      await loadSkills();
      setEditTarget(null);
      setShowAddDialog(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const installedIds = new Set(skills.map((s) => s.id));

  const filteredCatalogue = catalogueSearch
    ? SKILL_CATALOGUE.filter(
        (item) =>
          item.name.includes(catalogueSearch) ||
          item.description.includes(catalogueSearch) ||
          item.tags.some((t) => t.includes(catalogueSearch)),
      )
    : SKILL_CATALOGUE;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* ── Installed skills ─────────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              已安装 Skill
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowAddDialog(true);
                setEditTarget(null);
              }}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs text-white hover:opacity-90"
            >
              <span>+</span>
              <span>新建</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {loading ? (
              <p className="py-3 text-center text-xs text-ink-subtle">加载中…</p>
            ) : skills.length === 0 ? (
              <p className="py-3 text-center text-xs text-ink-subtle">
                暂无已安装的 Skill，从下方目录安装或点击「新建」创建。
              </p>
            ) : (
              skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onEdit={() => handleEdit(skill.id)}
                  onDelete={() => handleDelete(skill.id, skill.name)}
                />
              ))
            )}
          </div>
        </section>

        {/* ── Skill catalogue ──────────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Skill 目录
            </h3>
            <input
              type="text"
              value={catalogueSearch}
              onChange={(e) => setCatalogueSearch(e.target.value)}
              placeholder="搜索…"
              className="h-7 w-40 rounded-md border border-black/10 bg-surface px-2 text-xs text-ink placeholder:text-ink-subtle focus:border-accent/40 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredCatalogue.map((item) => {
              const installed = installedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-black/5 bg-surface p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-base">
                    {skillTagEmoji(item.tags)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{item.name}</span>
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-subtle"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !installed && handleInstall(item)}
                    disabled={installed}
                    className={`shrink-0 rounded-md px-3 py-1 text-xs transition-colors ${
                      installed
                        ? 'border border-black/10 text-ink-subtle cursor-default'
                        : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    {installed ? '已安装' : '安装'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {error && (
        <div className="absolute bottom-4 right-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showAddDialog && (
        <EditDialog
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => {
            setShowAddDialog(false);
            setEditTarget(null);
          }}
          isNew={!editTarget || !installedIds.has(editTarget.id)}
        />
      )}
    </div>
  );
}

// ── Skill card ────────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: SkillListItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/5 bg-surface px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-sm">
        ✦
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-ink">{skill.name}</span>
        {skill.description && <p className="text-xs text-ink-muted">{skill.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
          title="编辑"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-ink-subtle hover:bg-red-500/10 hover:text-red-500"
          title="删除"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function skillTagEmoji(tags: string[]): string {
  if (tags.includes('开发')) return '💻';
  if (tags.includes('数据库')) return '🗄️';
  if (tags.includes('数据')) return '📊';
  if (tags.includes('翻译')) return '🌐';
  if (tags.includes('写作')) return '✍️';
  if (tags.includes('语言')) return '💬';
  if (tags.includes('产品')) return '📋';
  if (tags.includes('教育')) return '📚';
  if (tags.includes('工具')) return '🔧';
  return '✦';
}

function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2l2 2-7 7H2v-2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4h9M5 4V2.5h3V4M4.5 4l.5 6h3l.5-6" />
    </svg>
  );
}
