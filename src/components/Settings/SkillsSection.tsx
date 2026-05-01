import { useEffect, useState } from 'react';
import type { Skill, SkillListItem } from '@shared/types';
import clsx from 'clsx';

interface SkillListWithDetails extends SkillListItem {
  id: string;
  name: string;
  description: string;
  details?: Skill;
}

export function SkillsSection() {
  const [skills, setSkills] = useState<SkillListWithDetails[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await window.api.skills.list();
      setSkills(list);
      if (list.length > 0 && !selectedSkillId) {
        setSelectedSkillId(list[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedSkillDetails = async (id: string) => {
    try {
      const skill = await window.api.skills.get({ id });
      if (skill) {
        setEditingName(skill.name);
        setEditingDesc(skill.description);
        setEditingBody(skill.body);
        setSkills((prev) =>
          prev.map((s) => (s.id === id ? { ...s, details: skill } : s))
        );
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSelectSkill = (id: string) => {
    setSelectedSkillId(id);
    setIsCreating(false);
    loadSelectedSkillDetails(id);
  };

  const handleCreate = async () => {
    if (!editingName.trim() || !editingDesc.trim()) {
      setError('名称和描述不能为空');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await window.api.skills.create({
        name: editingName,
        description: editingDesc,
        body: editingBody,
      });
      await loadSkills();
      setIsCreating(false);
      setEditingName('');
      setEditingDesc('');
      setEditingBody('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSkillId) return;
    if (!editingName.trim() || !editingDesc.trim()) {
      setError('名称和描述不能为空');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await window.api.skills.update({
        id: selectedSkillId,
        name: editingName,
        description: editingDesc,
        body: editingBody,
      });
      await loadSkills();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSkillId || !confirm('确定要删除这个 Skill 吗？')) return;

    try {
      setLoading(true);
      setError(null);
      await window.api.skills.delete({ id: selectedSkillId });
      setSelectedSkillId(null);
      await loadSkills();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const currentSkill = selectedSkillId
    ? skills.find((s) => s.id === selectedSkillId)
    : null;

  // 在编辑状态下使用纵向布局，给编辑器更多空间
  const isEditing = isCreating || selectedSkillId;
  const containerClass = isEditing
    ? 'flex h-full flex-col gap-6'
    : 'flex h-full gap-6';
  const listClass = isEditing
    ? 'max-h-32 overflow-y-auto border-b border-black/5 pb-3 px-4 pt-4'
    : 'w-56 overflow-y-auto border-r border-black/5 px-4 pt-4';

  return (
    <div className={containerClass}>
      {/* Skill List */}
      <div className={listClass}>
        <button
          onClick={() => {
            setIsCreating(true);
            setSelectedSkillId(null);
            setEditingName('');
            setEditingDesc('');
            setEditingBody('');
          }}
          className="mb-4 w-full rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20"
        >
          + 新建 Skill
        </button>

        {!isEditing && (
          <div className="space-y-2">
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => handleSelectSkill(skill.id)}
                className={clsx(
                  'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selectedSkillId === skill.id
                    ? 'bg-accent/20 text-accent'
                    : 'hover:bg-surface-muted'
                )}
              >
                <div className="font-medium">{skill.name}</div>
                <div className="text-xs text-black/60">{skill.description}</div>
              </button>
            ))}
          </div>
        )}
        {isEditing && (
          <div className="inline-flex flex-wrap gap-2">
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => handleSelectSkill(skill.id)}
                className={clsx(
                  'rounded-md px-2 py-1 text-xs transition-colors',
                  selectedSkillId === skill.id
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface-muted hover:bg-surface-sunken'
                )}
              >
                {skill.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto pr-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-black/60">加载中...</div>
          </div>
        ) : isCreating ? (
          <SkillEditor
            name={editingName}
            description={editingDesc}
            body={editingBody}
            onNameChange={setEditingName}
            onDescChange={setEditingDesc}
            onBodyChange={setEditingBody}
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
            isNew
          />
        ) : currentSkill ? (
          <SkillEditor
            name={editingName}
            description={editingDesc}
            body={editingBody}
            onNameChange={setEditingName}
            onDescChange={setEditingDesc}
            onBodyChange={setEditingBody}
            onSave={handleSave}
            onDelete={handleDelete}
            isNew={false}
          />
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-black/60">选择或创建一个 Skill</div>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-4 right-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

interface SkillEditorProps {
  name: string;
  description: string;
  body: string;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  isNew: boolean;
}

function SkillEditor({
  name,
  description,
  body,
  onNameChange,
  onDescChange,
  onBodyChange,
  onSave,
  onDelete,
  onCancel,
  isNew,
}: SkillEditorProps) {
  return (
    <div className="space-y-5 p-6">
      <div>
        <label className="block text-sm font-medium text-black/70 mb-1">
          Skill 名称
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="例如：代码审查、翻译助手"
          className="w-full rounded-lg border border-black/10 bg-surface-muted px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black/70 mb-1">
          描述
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="简要描述这个 Skill 的用途"
          className="w-full rounded-lg border border-black/10 bg-surface-muted px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black/70 mb-2">
          系统提示词
        </label>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={`你是一个...

当用户...时，你要...

输出格式：
- 要点1
- 要点2`}
          rows={12}
          className="w-full rounded-lg border border-black/10 bg-surface-muted px-3 py-2 text-sm font-mono"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          {isNew ? '创建' : '保存'}
        </button>
        {!isNew && onDelete && (
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            删除
          </button>
        )}
        {isNew && onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
