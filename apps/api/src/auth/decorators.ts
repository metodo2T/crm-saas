import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentOrg = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.auth?.organizationId;
  },
);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.auth?.userId;
  },
);
