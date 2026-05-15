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
import { WaLeadPanel } from './wa-lead-panel';

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
      {/* Sidebar conversations */}
      <aside className="w-72 border-r border-[#334155] bg-[#1e293b] flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-slate-200">
              {instance.phone ? `+${instance.phone}` : 'WhatsApp'}
            </span>
          </div>
          <button
            onClick={() => disconnectMutation.mutate()}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors"
            title="Desconectar"
          >
            Desconectar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-slate-600 text-center mt-8">
              Nenhuma conversa ainda.<br />As mensagens recebidas aparecerão aqui.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.remoteJid}
                onClick={() => setSelectedJid(conv.remoteJid)}
                className={`w-full text-left px-4 py-3 border-b border-[#334155]/50 transition-colors ${
                  selectedJid === conv.remoteJid
                    ? 'bg-indigo-500/15 border-l-2 border-l-indigo-500'
                    : 'hover:bg-[#334155]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {conv.lead?.name ?? conv.remoteJid.split('@')[0]}
                  </p>
                  <span className="text-[10px] text-slate-600 shrink-0">
                    {formatDistanceToNow(new Date(conv.lastTimestamp), { addSuffix: false, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                {conv.unread > 0 && (
                  <span className="inline-block mt-1 bg-emerald-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex-1 flex flex-col bg-[#0f172a] min-w-0">
        {!selectedJid ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-[#1e293b] border-b border-[#334155] shrink-0">
              <p className="text-sm font-semibold text-slate-200">{displayName(selectedJid)}</p>
              {selectedConv?.lead && (
                <p className="text-xs text-slate-500">{selectedJid.split('@')[0]}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                    msg.fromMe
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-[#1e293b] border border-[#334155] text-slate-200 rounded-bl-sm'
                  }`}>
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 ${msg.fromMe ? 'text-indigo-200' : 'text-slate-600'}`}>
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="px-4 py-3 bg-[#1e293b] border-t border-[#334155] flex gap-2 shrink-0">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                disabled={!text.trim() || sendMutation.isPending}
              >
                Enviar
              </Button>
            </form>
          </>
        )}
      </main>

      {selectedJid && (
        <WaLeadPanel
          jid={selectedJid}
          lead={selectedConv?.lead ?? null}
          onLinkChange={() =>
            queryClient.invalidateQueries({ queryKey: ['wa', 'conversations', organization?.id] })
          }
        />
      )}
    </div>
  );
}
