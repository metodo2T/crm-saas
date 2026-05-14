const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type StageType = 'REGULAR' | 'WON' | 'LOST';

export interface DealLead {
  id: string;
  name: string;
}

export interface DealAssignee {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface DealStage {
  id: string;
  name: string;
  color: string;
  type: StageType;
}

export interface Deal {
  id: string;
  organizationId: string;
  pipelineId: string;
  stageId: string;
  stage: DealStage;
  leadId?: string;
  lead?: DealLead;
  title: string;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  assignedTo?: DealAssignee | null;
  notes?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
  order: number;
  type: StageType;
  totalValue: number;
  deals: Deal[];
}

export interface PipelineKanban {
  id: string;
  stages: KanbanStage[];
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getKanban(token: string): Promise<PipelineKanban> {
  return apiFetch('/pipeline', token);
}

export async function createDeal(token: string, data: {
  title: string;
  stageId: string;
  leadId?: string;
  value?: number;
  probability?: number;
  expectedCloseAt?: string;
  assignedToId?: string;
  notes?: string;
}): Promise<Deal> {
  return apiFetch('/deals', token, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDeal(token: string, id: string, data: {
  title?: string;
  leadId?: string | null;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
}): Promise<Deal> {
  return apiFetch(`/deals/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function moveDeal(token: string, id: string, stageId: string, lostReason?: string): Promise<Deal> {
  return apiFetch(`/deals/${id}/move`, token, { method: 'PATCH', body: JSON.stringify({ stageId, lostReason }) });
}

export async function deleteDeal(token: string, id: string): Promise<{ deleted: string }> {
  return apiFetch(`/deals/${id}`, token, { method: 'DELETE' });
}

export async function createStage(token: string, data: { name: string; color?: string }) {
  return apiFetch('/pipeline/stages', token, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateStage(token: string, id: string, data: { name?: string; color?: string }) {
  return apiFetch(`/pipeline/stages/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteStage(token: string, id: string) {
  return apiFetch(`/pipeline/stages/${id}`, token, { method: 'DELETE' });
}

export async function reorderStages(token: string, stageIds: string[]) {
  return apiFetch('/pipeline/stages/reorder', token, { method: 'PATCH', body: JSON.stringify({ stageIds }) });
}
