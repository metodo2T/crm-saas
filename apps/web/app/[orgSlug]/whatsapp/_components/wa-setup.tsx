'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getWaInstance, createWaInstance, getWaQrCode, WaInstance } from '@/lib/api/whatsapp';
import { Button } from '@/components/ui/button';

export function WaSetup({ onConnected }: { onConnected: () => void }) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [showQr, setShowQr] = useState(false);

  const { data: instance, isLoading } = useQuery<WaInstance | null>({
    queryKey: ['wa', 'instance', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaInstance(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: showQr ? 3000 : false,
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
    enabled: showQr && instance?.status === 'CONNECTING',
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return createWaInstance(token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa', 'instance', organization?.id] });
      setShowQr(true);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-2">Conectar WhatsApp</h2>
      <p className="text-sm text-slate-500 mb-8">
        Conecte seu número do WhatsApp para capturar leads, responder mensagens e enviar notificações diretamente do CRM.
      </p>

      {!instance && (
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Criando...' : 'Conectar WhatsApp'}
        </Button>
      )}

      {instance?.status === 'CONNECTING' && showQr && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-4">
            Abra o WhatsApp no seu celular → Menu → Aparelhos conectados → Conectar um aparelho → escaneie o QR code abaixo
          </p>
          {qrLoading ? (
            <div className="w-48 h-48 bg-slate-100 rounded-xl mx-auto flex items-center justify-center text-slate-400 text-xs">
              Gerando QR code...
            </div>
          ) : qr?.qrcode ? (
            <div className="flex flex-col items-center gap-3">
              {qr.qrcode.startsWith('data:') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr.qrcode} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl border border-slate-200" />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="font-mono text-xs break-all text-slate-600 max-w-xs">{qr.qrcode}</p>
                </div>
              )}
              <p className="text-xs text-slate-400">O QR code atualiza automaticamente a cada 15 segundos</p>
            </div>
          ) : (
            <p className="text-xs text-red-500">Não foi possível gerar o QR code. Tente novamente.</p>
          )}
        </div>
      )}

      {instance?.status === 'CONNECTING' && !showQr && (
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setShowQr(true)}
        >
          Ver QR Code
        </Button>
      )}
    </div>
  );
}
