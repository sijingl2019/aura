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
    case 'done': {
      const conversationId = streaming.conversationId;
      streaming.reset();
      if (conversationId) {
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
}): Promise<void> {
  const convStore = useConversationsStore.getState();
  const current = convStore.messages[params.conversationId] ?? [];
  const optimistic: ChatMessage = {
    id: `__pending_${Date.now()}`,
    conversationId: params.conversationId,
    role: 'user',
    content: params.userText,
    createdAt: Date.now(),
  };
  convStore.replaceMessages(params.conversationId, [...current, optimistic]);

  const { streamId } = await window.api.llm.stream(params);
  useStreamingStore.getState().begin({ streamId, conversationId: params.conversationId });
}

export async function abortStream(): Promise<void> {
  const { streamId } = useStreamingStore.getState();
  if (!streamId) return;
  await window.api.llm.abort({ streamId });
}
