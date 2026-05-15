export class UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  assignedToId?: string;
  customData?: Record<string, unknown>;
}
