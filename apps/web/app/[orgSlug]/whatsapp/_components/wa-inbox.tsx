'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getWaConversations, getWaMessages, sendWaMessage, deleteWaInstance,
  WaConversation, WaMessage, WaInstance,
} from '@/lib/api/whatsapp';
import { Button } from '@/components/ui/button';

interface Props {
  instance: WaInstance;
  onDisconnect: () => void;
  initialJid?: string | null;
}

export function WaInbox({ instance, onDisconnect, initialJid }: Props) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedJid, setSelectedJid] = useState<string | null>(initialJid ?? null);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<WaConversation[]>({
    queryKey: ['wa', 'conversations', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaConversations(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<WaMessage[]>({
    queryKey: ['wa', 'messages', organization?.id, selectedJid],
    queryFn: async () => {
      const token = await getToken();
      return getWaMessages(token!, selectedJid!);
    },
    enabled: !!selectedJid && !!organization?.id,
    refetchInterval: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const token = await getToken();
      return sendWaMessage(token!, selectedJid!, msg);
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['wa', 'messages', organization?.id, selectedJid] });
      queryClient.invalidateQueries({ queryKey: ['wa', 'conversations', organization?.id] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteWaInstance(token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa', 'instance', organization?.id] });
      onDisconnect();
    },
  });

  const selectedConv = conversations.find((c) => c.remoteJid === selectedJid);
  const displayName = (jid: string) => {
    const conv = conversations.find((c) => c.remoteJid === jid);
    return conv?.lead?.name ?? jid.split('@')[0];
  };

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selectedJid) return;
    sendMutation.mutate(text.trim());
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-slate-900">
              {instance.phone ? `+${instance.phone}` : 'WhatsApp'}
            </span>
          </div>
          <button
            onClick={() => disconnectMutation.mutate()}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            title="Desconectar"
          >
            Desconectar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center mt-8">
              Nenhuma conversa ainda.<br />As mensagens recebidas aparecerão aqui.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.remoteJid}
                onClick={() => setSelectedJid(conv.remoteJid)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  selectedJid === conv.remoteJid ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {conv.lead?.name ?? conv.remoteJid.split('@')[0]}
                  </p>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDistanceToNow(new Date(conv.lastTimestamp), { addSuffix: false, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                {conv.unread > 0 && (
                  <span className="inline-block mt-1 bg-green-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col bg-slate-50 min-w-0">
        {!selectedJid ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Selecione uma conversa
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 shrink-0">
              <p className="text-sm font-semibold text-slate-900">{displayName(selectedJid)}</p>
              {selectedConv?.lead && (
                <p className="text-xs text-slate-400">{selectedJid.split('@')[0]}</p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                      msg.fromMe
                        ? 'bg-green-500 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm'
                    }`}
                  >
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.fromMe ? 'text-green-100' : 'text-slate-400'}`}>
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} className="px-4 py-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                disabled={!text.trim() || sendMutation.isPending}
              >
                Enviar
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
