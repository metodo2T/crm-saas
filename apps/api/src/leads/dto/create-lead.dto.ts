export class CreateLeadDto {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  source: 'MANUAL' | 'CSV' | 'FORM' | 'WHATSAPP';
  assignedToId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
}
