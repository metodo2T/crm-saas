import { SetMetadata } from '@nestjs/common';

export const CHECK_PLAN_LIMIT_KEY = 'planLimit';
export const CheckPlanLimit = (resource: 'leads' | 'users' | 'whatsapp') =>
  SetMetadata(CHECK_PLAN_LIMIT_KEY, resource);
