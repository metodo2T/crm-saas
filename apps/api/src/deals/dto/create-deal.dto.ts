export class CreateDealDto {
  title: string;
  stageId: string;
  leadId?: string;
  value?: number;
  probability?: number;
  expectedCloseAt?: string;
  assignedToId?: string;
  notes?: string;
}
