export interface SystemPromptSnapshotInput {
  storedPrompt?: string | null;
  freshPrompt: string;
  compressedSummary?: string;
}

export interface SystemPromptSnapshotResult {
  prompt: string;
  shouldStore: boolean;
}

export function resolveSystemPromptSnapshot({
  storedPrompt,
  freshPrompt,
  compressedSummary,
}: SystemPromptSnapshotInput): SystemPromptSnapshotResult {
  const basePrompt = storedPrompt?.trim() ? storedPrompt : freshPrompt;
  const summary = compressedSummary?.trim();
  return {
    prompt: summary ? `${basePrompt}\n\n${summary}` : basePrompt,
    shouldStore: !storedPrompt?.trim(),
  };
}

export function buildPromptText({
  expandedUserText,
  skillBody,
}: {
  userText: string;
  expandedUserText: string;
  skillBody?: string;
}): string {
  const skill = skillBody?.trim();
  if (!skill) return expandedUserText;
  return [
    '请按以下 Skill 指令处理本轮用户请求：',
    skill,
    '',
    '用户请求：',
    expandedUserText,
  ].join('\n');
}
