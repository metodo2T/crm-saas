const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type WaInstanceStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
export type WaMsgStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface WaInstance {
  id: string;
  organizationId: string;
  instanceName: string;
  token: string | null;
  status: WaInstanceStatus;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaConversation {
  remoteJid: string;
  lead: { id: string; name: string; phone: string | null; email: string | null; status: string } | null;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
}

export interface WaMessage {
  id: string;
  instanceId: string;
  leadId: string | null;
  remoteJid: string;
  fromMe: boolean;
  body: string;
  messageId: string;
  status: WaMsgStatus;
  timestamp: string;
  createdAt: string;
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWaInstance(token: string): Promise<WaInstance | null> {
  try {
    return await apiFetch('/whatsapp/instance', token);
  } catch {
    return null;
  }
}

export async function saveWaInstance(token: string, instanceId: string, instanceToken: string): Promise<WaInstance> {
  return apiFetch('/whatsapp/instance', token, {
    method: 'POST',
    body: JSON.stringify({ instanceId, token: instanceToken }),
  });
}

export async function refreshWaStatus(token: string): Promise<WaInstance> {
  return apiFetch('/whatsapp/instance/refresh', token, { method: 'POST' });
}

export async function deleteWaInstance(token: string): Promise<void> {
  await apiFetch('/whatsapp/instance', token, { method: 'DELETE' });
}

export async function getWaQrCode(token: string): Promise<{ base64?: string }> {
  return apiFetch('/whatsapp/instance/qr', token);
}

export async function getWaConversations(token: string): Promise<WaConversation[]> {
  return apiFetch('/whatsapp/conversations', token);
}

export async function getWaMessages(token: string, jid: string): Promise<WaMessage[]> {
  return apiFetch(`/whatsapp/conversations/${encodeURIComponent(jid)}/messages`, token);
}

export async function sendWaMessage(token: string, jid: string, text: string): Promise<WaMessage> {
  return apiFetch(`/whatsapp/conversations/${encodeURIComponent(jid)}/messages`, token, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function linkWaLead(
  token: string,
  jid: string,
  leadId: string | null,
): Promise<{ lead: { id: string; name: string; phone: string | null; email: string | null; status: string; source: string } | null }> {
  return apiFetch(`/whatsapp/conversations/${encodeURIComponent(jid)}/lead`, token, {
    method: 'PATCH',
    body: JSON.stringify({ leadId }),
  });
}
