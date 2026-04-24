import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatView } from '@/components/ChatView';
import { Composer } from '@/components/Composer';
import { useConversationsStore } from '@/stores/conversations';

export function ChatRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const select = useConversationsStore((s) => s.select);
  const create = useConversationsStore((s) => s.create);

  useEffect(() => {
    select(id ?? null);
  }, [id, select]);

  const handleNeedConversation = async () => {
    const conv = await create();
    navigate(`/c/${conv.id}`);
    return conv.id;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {id ? (
        <ChatView conversationId={id} />
      ) : (
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="flex w-full max-w-2xl flex-col items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              <span className="text-accent">✷</span> Let&apos;s knock something off your list
            </h1>
            <p className="text-sm text-ink-muted">发送一条消息即可开始新的对话。</p>
          </div>
        </div>
      )}
      <Composer conversationId={id ?? null} onNeedConversation={handleNeedConversation} />
    </div>
  );
}
