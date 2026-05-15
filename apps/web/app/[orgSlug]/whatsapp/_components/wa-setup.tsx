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
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/whatsapp/webhook`;

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
  const canSave = (instanceId.trim() || instance?.instanceName) && (instanceToken.trim() || instance?.token);

  return (
    <div className="max-w-lg mx-auto mt-12 pb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-950 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Conectar WhatsApp</h2>
          <p className="text-sm text-slate-500">Integração via Z-API</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Crie uma conta na Z-API</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Acesse{' '}
              <a href="https://app.z-api.io" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-medium">
                app.z-api.io
              </a>{' '}
              → crie conta gratuita → crie uma instância → copie o <strong className="text-slate-300">Instance ID</strong> e o <strong className="text-slate-300">Token</strong>.
            </p>
          </div>
        </div>

        <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200">Configure o Webhook na Z-API</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">
              Na sua instância Z-API → <strong className="text-slate-300">Webhooks</strong> → cole a URL abaixo:
            </p>
            <div className="flex items-center gap-2 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2">
              <code className="text-xs text-slate-400 flex-1 truncate">{webhookUrl}</code>
              <button
                onClick={copyWebhook}
                className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shrink-0 transition-colors"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">Cole as credenciais e salve</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Instance ID</label>
                <input
                  type="text"
                  value={instanceId || instance?.instanceName || ''}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="Ex: 3A6C6215-39A1-4990-873B..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Instance Token</label>
                <input
                  type="password"
                  value={instanceToken || (instance?.token ? '••••••••' : '')}
                  onChange={(e) => setInstanceToken(e.target.value)}
                  placeholder="Token da instância Z-API"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !canSave}
                >
                  {saveMutation.isPending ? 'Verificando...' : 'Salvar e conectar'}
                </Button>
                {isConfigured && (
                  <Button
                    variant="outline"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="text-xs border-[#334155] bg-transparent text-slate-400 hover:bg-[#334155]"
                  >
                    {refreshMutation.isPending ? '...' : 'Atualizar'}
                  </Button>
                )}
              </div>
              {saveMutation.isError && (
                <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                  Erro ao verificar credenciais. Verifique se o Instance ID e o Token estão corretos e tente novamente.
                </p>
              )}
            </div>
          </div>
        </div>

        {(showQr || isConfigured) && instance?.status !== 'CONNECTED' && (
          <div className="flex gap-3 bg-[#1e293b] border border-[#334155] rounded-xl p-4">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">Escaneie o QR Code</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                No WhatsApp do seu celular: <strong className="text-slate-300">Menu (⋮) → Aparelhos conectados → Conectar um aparelho</strong>
              </p>
              {!showQr ? (
                <Button size="sm" variant="outline" onClick={() => setShowQr(true)} className="text-xs border-[#334155] bg-transparent text-slate-400 hover:bg-[#334155]">
                  Ver QR Code
                </Button>
              ) : qrLoading ? (
                <div className="w-48 h-48 bg-[#0f172a] rounded-xl flex items-center justify-center text-slate-600 text-xs">
                  Carregando QR...
                </div>
              ) : qr?.base64 ? (
                <div className="flex flex-col items-center gap-2 max-w-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.base64} alt="QR Code WhatsApp" className="w-52 h-52 rounded-xl border border-[#334155]" />
                  <p className="text-xs text-slate-600">Atualiza automaticamente a cada 20s</p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  QR code não disponível. Clique em <strong>Atualizar</strong> acima ou aguarde.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {isConfigured && !showQr && instance?.status !== 'CONNECTED' && (
        <div className="flex items-center justify-between bg-amber-950 border border-amber-900 rounded-xl px-4 py-3 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm text-amber-400">WhatsApp desconectado</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-amber-800 text-amber-400 hover:bg-amber-900 bg-transparent"
            onClick={() => setShowQr(true)}
          >
            Ver QR Code
          </Button>
        </div>
      )}
    </div>
  );
}
