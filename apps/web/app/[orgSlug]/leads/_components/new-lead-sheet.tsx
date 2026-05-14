'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLead, Lead, LeadSource } from '@/lib/api/leads';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPhone?: string;
  defaultSource?: LeadSource;
  onCreated?: (lead: Lead) => void;
}

export function NewLeadSheet({ open, onClose, defaultPhone, defaultSource, onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setPhone(defaultPhone ?? '');
  }, [open, defaultPhone]);

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Nome é obrigatório');
      if (!email.trim() && !phone.trim()) throw new Error('Email ou telefone é obrigatório');
      const token = await getToken();
      return createLead(token!, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        source: defaultSource ?? 'MANUAL',
      });
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      onCreated?.(lead);
      setName('');
      setEmail('');
      setPhone(defaultPhone ?? '');
      setCompany('');
      setError('');
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleClose() {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setError('');
    mutation.reset();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-[400px] bg-slate-900 border-slate-700 text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Novo Lead</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4 px-1">
          <div>
            <Label className="text-slate-400 text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="email@exemplo.com"
              type="email"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="(11) 99999-0000"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Empresa</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="Nome da empresa"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {mutation.isPending ? 'Salvando...' : 'Criar Lead'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
