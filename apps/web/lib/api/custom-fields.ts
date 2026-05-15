const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as any;
  return res.json();
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'CHECKBOX' | 'URL';
export type CustomFieldEntity = 'LEAD' | 'DEAL';

export interface CustomFieldDef {
  id: string;
  entity: CustomFieldEntity;
  name: string;
  slug: string;
  type: CustomFieldType;
  options?: string[] | null;
  order: number;
  createdAt: string;
}

export function getCustomFields(token: string, entity: CustomFieldEntity): Promise<CustomFieldDef[]> {
  return apiFetch(`/custom-fields?entity=${entity}`, token);
}

export function createCustomField(
  token: string,
  entity: CustomFieldEntity,
  name: string,
  type: CustomFieldType,
  options?: string[],
): Promise<CustomFieldDef> {
  return apiFetch('/custom-fields', token, {
    method: 'POST',
    body: JSON.stringify({ entity, name, type, options }),
  });
}

export function updateCustomField(
  token: string,
  id: string,
  data: { name?: string; options?: string[]; order?: number },
): Promise<CustomFieldDef> {
  return apiFetch(`/custom-fields/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCustomField(token: string, id: string): Promise<void> {
  return apiFetch(`/custom-fields/${id}`, token, { method: 'DELETE' });
}
