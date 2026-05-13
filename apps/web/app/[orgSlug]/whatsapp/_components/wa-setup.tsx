'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getWaInstance, saveWaInstance, getWaQrCode, refreshWaStatus, WaInstance } from '@/lib/api/whatsapp';
import { Button } from '@/components/ui/button';

interface Props {
  onConnected: () => void;
}

export function WaSetup({ onConnected }: Props) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [instanceId, setInstanceId] = useState('');
  const [instanceToken, setInstanceToken] = useState('');
  const [showQr, setShowQr] = useState(false);

  const { data: instance } = useQuery<WaInstance | null>({
    queryKey: ['wa', 'instance', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaInstance(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: showQr ? 5000 : false,
    select: (d) => {
      if (d?.status === 'CONNECTED') onConnected();
      return d;
    },
  });

  const { data: qr, isLoading: qrLoading } = useQuery({
    queryKey: ['wa', 'qr', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaQrCode(token!);
    },
    enabled: showQr && !!instance && instance.status !== 'CONNECTED',
    refetchInterval: 20000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return saveWaInstance(token!, instanceId.trim(), instanceToken.trim());
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['wa', 'instance', organization?.id], data);
      if (data.status === 'CONNECTED') {
        onConnected();
      } else {
        setShowQr(true);
      }
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return refreshWaStatus(token!);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['wa', 'instance', organization?.id], data);
      if (data.status === 'CONNECTED') onConnected();
    },
  });

  const isConfigured = !!instance?.instanceName && !!instance?.token;

  return (
    <div className="max-w-lg mx-auto mt-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Conectar WhatsApp</h2>
          <p className="text-sm text-slate-500">via Z-API</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800 space-y-1.5">
        <p className="font-semibold mb-2">Como obter as credenciais:</p>
        <p>1. Acesse <a href="https://z-api.io" target="_blank" rel="noreferrer" className="underline font-medium">z-api.io</a> e crie uma conta gratuita</p>
        <p>2. Crie uma instância no painel</p>
        <p>3. Copie o <strong>Instance ID</strong> e o <strong>Instance Token</strong></p>
        <p>4. Em Configurações da instância, configure o webhook para:</p>
        <p className="font-mono text-xs bg-blue-100 px-2 py-1 rounded break-all">
          {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/whatsapp/webhook
        </p>
        <p>5. Cole as credenciais abaixo e clique em Salvar</p>
      </div>

      {/* Credential form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Instance ID
          </label>
          <input
            type="text"
            value={instanceId || instance?.instanceName || ''}
            onChange={(e) => setInstanceId(e.target.value)}
            placeholder="Ex: 3A6C6215-39A1-4990-873B..."
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Instance Token
          </label>
          <input
            type="password"
            value={instanceToken || (instance?.token ? '••••••••' : '')}
            onChange={(e) => setInstanceToken(e.target.value)}
            placeholder="Token da instância Z-API"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white flex-1"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!instanceId && !instance?.instanceName)}
          >
            {saveMutation.isPending ? 'Verificando...' : 'Salvar e verificar'}
          </Button>
          {isConfigured && (
            <Button
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="text-xs"
            >
              {refreshMutation.isPending ? '...' : 'Atualizar status'}
            </Button>
          )}
        </div>

        {saveMutation.isError && (
          <p className="text-xs text-red-500">
            Erro ao verificar credenciais. Confira os dados e tente novamente.
          </p>
        )}
      </div>

      {/* QR Code section */}
      {showQr && instance && instance.status !== 'CONNECTED' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5 text-center">
          <p className="text-sm font-semibold text-slate-900 mb-1">Escanear QR Code</p>
          <p className="text-xs text-slate-500 mb-4">
            WhatsApp → Menu (3 pontos) → Aparelhos conectados → Conectar um aparelho
          </p>
          {qrLoading ? (
            <div className="w-48 h-48 bg-slate-100 rounded-xl mx-auto flex items-center justify-center text-slate-400 text-xs">
              Carregando QR...
            </div>
          ) : qr?.base64 ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.base64} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl border border-slate-200" />
              <p className="text-xs text-slate-400">Atualiza a cada 20 segundos</p>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              QR code ainda não disponível.{' '}
              <button onClick={() => setShowQr(false)} className="text-blue-600 underline">Voltar</button>
            </div>
          )}
        </div>
      )}

      {/* Already configured but disconnected */}
      {isConfigured && !showQr && instance.status !== 'CONNECTED' && (
        <div className="mt-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm text-amber-800">WhatsApp desconectado</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setShowQr(true)}
          >
            Ver QR Code
          </Button>
        </div>
      )}
    </div>
  );
}
