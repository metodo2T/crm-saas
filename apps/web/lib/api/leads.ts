const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type LeadStatus = 'NOVO' | 'CONTATADO' | 'QUALIFICADO' | 'CONVERTIDO' | 'DESCARTADO';
export type LeadSource = 'MANUAL' | 'FORM' | 'CSV' | 'WHATSAPP';

export interface Lead {
  id: string;
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  status: LeadStatus;
  source: LeadSource;
  assignedToId?: string;
  assignedTo?: { id: string; name: string; avatarUrl?: string };
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanData {
  NOVO: Lead[];
  CONTATADO: Lead[];
  QUALIFICADO: Lead[];
  CONVERTIDO: Lead[];
  DESCARTADO: Lead[];
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getKanban(token: string): Promise<KanbanData> {
  return apiFetch('/leads/kanban', token);
}

export async function createLead(token: string, data: {
  name: string; email?: string; phone?: string; company?: string;
  notes?: string; source: LeadSource; assignedToId?: string;
}): Promise<Lead> {
  return apiFetch('/leads', token, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLeadStatus(token: string, id: string, status: LeadStatus): Promise<Lead> {
  return apiFetch(`/leads/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function updateLead(token: string, id: string, data: Partial<Lead>): Promise<Lead> {
  return apiFetch(`/leads/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function assignLead(token: string, id: string, assignedToId: string | null): Promise<Lead> {
  return apiFetch(`/leads/${id}/assign`, token, { method: 'PATCH', body: JSON.stringify({ assignedToId }) });
}

export async function deleteLead(token: string, id: string): Promise<Lead> {
  return apiFetch(`/leads/${id}`, token, { method: 'DELETE' });
}

export async function importCsv(token: string, file: File): Promise<{ imported: number; skipped: number; errors: Array<{ row: number; reason: string }> }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/leads/import/csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportLeadsCsv(token: string, filters?: { status?: string; source?: string }): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.source) params.set('source', filters.source);
  const res = await fetch(`${API}/leads/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Falha ao exportar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function bulkAction(
  token: string,
  ids: string[],
  action: 'status' | 'delete',
  status?: LeadStatus,
): Promise<{ updated: number }> {
  return apiFetch('/leads/bulk', token, {
    method: 'PATCH',
    body: JSON.stringify({ ids, action, status }),
  });
}

export interface AnalyticsTrend {
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  trend: Array<{ date: string; total: number }>;
}

export async function getAnalytics(token: string): Promise<AnalyticsTrend> {
  return apiFetch('/leads/analytics', token);
}
