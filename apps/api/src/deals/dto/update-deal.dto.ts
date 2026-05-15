export class UpdateDealDto {
  title?: string;
  leadId?: string | null;
  value?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
  customData?: Record<string, unknown>;
}
