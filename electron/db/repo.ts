import { randomUUID } from 'node:crypto';
import { getDb } from './index';
import type { ChatMessage, Conversation, MessageRole, ToolCall } from '@shared/types';

interface ConversationRow {
  id: string;
  title: string;
  model: string | null;
  provider: string | null;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tool_calls: string | null;
  tool_call_id: string | null;
  created_at: number;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  skill_name: string | null;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    model: row.model ?? undefined,
    provider: (row.provider as Conversation['provider']) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls ? (JSON.parse(row.tool_calls) as ToolCall[]) : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    createdAt: row.created_at,
    model: row.model ?? undefined,
    inputTokens: row.input_tokens ?? undefined,
    outputTokens: row.output_tokens ?? undefined,
    skillName: row.skill_name ?? undefined,
  };
}

export function listConversations(): Conversation[] {
  const rows = getDb()
    .prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
    .all() as ConversationRow[];
  return rows.map(mapConversation);
}

export function createConversation(title?: string): Conversation {
  const now = Date.now();
  const conv: Conversation = {
    id: randomUUID(),
    title: title?.trim() || '新对话',
    createdAt: now,
    updatedAt: now,
  };
  getDb()
    .prepare(
      'INSERT INTO conversations (id, title, model, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(conv.id, conv.title, null, null, conv.createdAt, conv.updatedAt);
  return conv;
}

export function deleteConversation(id: string): void {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function renameConversation(id: string, title: string): void {
  getDb()
    .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, Date.now(), id);
}

export function setConversationModel(id: string, providerId: string, modelId: string): void {
  getDb()
    .prepare('UPDATE conversations SET provider = ?, model = ?, updated_at = ? WHERE id = ?')
    .run(providerId, modelId, Date.now(), id);
}

export function getConversation(id: string): Conversation | null {
  const row = getDb()
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as ConversationRow | undefined;
  return row ? mapConversation(row) : null;
}

export function touchConversation(id: string): void {
  getDb().prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(Date.now(), id);
}

export function listMessages(conversationId: string): ChatMessage[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC',
    )
    .all(conversationId) as MessageRow[];
  return rows.map(mapMessage);
}

export interface AppendMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  skillName?: string;
}

export function appendMessage(input: AppendMessageInput): ChatMessage {
  const msg: ChatMessage = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    toolCalls: input.toolCalls,
    toolCallId: input.toolCallId,
    createdAt: Date.now(),
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    skillName: input.skillName,
  };
  getDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, created_at, model, input_tokens, output_tokens, skill_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      msg.id,
      msg.conversationId,
      msg.role,
      msg.content,
      msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      msg.toolCallId ?? null,
      msg.createdAt,
      msg.model ?? null,
      msg.inputTokens ?? null,
      msg.outputTokens ?? null,
      msg.skillName ?? null,
    );
  touchConversation(msg.conversationId);
  return msg;
}
