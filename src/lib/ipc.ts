import type { ChatMessage, StreamEvent } from '@shared/types';
import { useConversationsStore } from '@/stores/conversations';
import { useStreamingStore } from '@/stores/streaming';

let installed = false;
let unsubscribe: (() => void) | null = null;

export function installLlmEventListener(): () => void {
  if (installed && unsubscribe) return unsubscribe;
  installed = true;

  unsubscribe = window.api.llm.onEvent(handleEvent);
  return () => {
    unsubscribe?.();
    installed = false;
    unsubscribe = null;
  };
}

async function handleEvent(event: StreamEvent): Promise<void> {
  const streaming = useStreamingStore.getState();
  if (event.type !== 'done' && event.type !== 'error' && streaming.streamId !== event.streamId) {
    return;
  }

  switch (event.type) {
    case 'text':
      streaming.appendText(event.delta);
      break;
    case 'thinking':
      streaming.appendThinking(event.delta);
      break;
    case 'tool_call_start':
      streaming.toolCallStart(event.id, event.name);
      break;
    case 'tool_call_args':
      streaming.toolCallArgs(event.id, event.delta);
      break;
    case 'tool_call_end':
      streaming.toolCallEnd(event.id);
      break;
    case 'tool_result':
      streaming.toolResult(event.id, event.ok, event.preview);
      break;
    case 'error':
      streaming.setError(event.message);
      break;
    case 'steering': {
      // The agent consumed a mid-run interjection. Commit the in-flight assistant
      // draft as a finalized bubble, then append the user's steering bubble, so the
      // chat reads in order before the next turn streams into a fresh draft. These
      // optimistic rows are replaced by the real DB rows on `done`.
      const cid = streaming.conversationId;
      if (cid) {
        const convStore = useConversationsStore.getState();
        const current = convStore.messages[cid] ?? [];
        const next: ChatMessage[] = [...current];
        if (streaming.text || streaming.thinking || streaming.toolCalls.length > 0) {
          next.push({
            id: `__steer_flush_${Date.now()}`,
            conversationId: cid,
            role: 'assistant',
            content: streaming.text,
            thinking: streaming.thinking || undefined,
            toolCalls: streaming.toolCalls.map((c) => ({
              id: c.id,
              name: c.name,
              arguments: c.arguments,
            })),
            createdAt: Date.now(),
          });
        }
        next.push({
          id: `__steer_user_${Date.now()}`,
          conversationId: cid,
          role: 'user',
          content: event.text,
          createdAt: Date.now(),
        });
        convStore.replaceMessages(cid, next);
      }
      streaming.flushForSteer();
      break;
    }
    case 'done': {
      const conversationId = streaming.conversationId;
      streaming.reset();
      if (conversationId) {
        // Errors are now persisted as isError assistant messages, so reloading
        // surfaces them as bubbles — no transient error state to preserve.
        const convStore = useConversationsStore.getState();
        await convStore.loadMessages(conversationId);
        await convStore.loadList();
      }
      break;
    }
  }
}

export async function sendMessage(params: {
  conversationId: string;
  userText: string;
  skillId?: string;
  skillName?: string;
}): Promise<void> {
  const convStore = useConversationsStore.getState();
  const current = convStore.messages[params.conversationId] ?? [];
  const optimistic: ChatMessage = {
    id: `__pending_${Date.now()}`,
    conversationId: params.conversationId,
    role: 'user',
    content: params.userText,
    createdAt: Date.now(),
    skillName: params.skillName,
  };
  convStore.replaceMessages(params.conversationId, [...current, optimistic]);

  const { streamId } = await window.api.llm.stream(params);
  // User message is now persisted. Reload to fix any race with ChatView's initial loadMessages
  // (ChatView may have loaded an empty array before llm:stream saved the user row to DB).
  await convStore.loadMessages(params.conversationId);
  useStreamingStore.getState().begin({ streamId, conversationId: params.conversationId });
}

export async function abortStream(): Promise<void> {
  const { streamId } = useStreamingStore.getState();
  if (!streamId) return;
  await window.api.llm.abort({ streamId });
}

/** Inject a steering message into the currently-running agent. The interjection
 *  is delivered after the agent finishes its current step (tool batch / turn). */
export async function steerStream(text: string): Promise<void> {
  const trimmed = text.trim();
  const { streamId } = useStreamingStore.getState();
  if (!trimmed || !streamId) return;
  await window.api.llm.steer({ streamId, text: trimmed });
}
