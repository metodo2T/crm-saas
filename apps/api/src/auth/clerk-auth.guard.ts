import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      // Clerk v2 tokens store org info under `o.id`; v1 used `org_id`
      const clerkOrgId = (payload as any).o?.id ?? (payload as any).org_id;
      if (!clerkOrgId) {
        throw new UnauthorizedException('Organization context required');
      }
      // Resolve internal UUID from clerkOrgId
      const org = await this.prisma.organization.findUnique({ where: { clerkOrgId } });
      if (!org) {
        throw new UnauthorizedException('Organization not found');
      }
      request.auth = {
        userId: payload.sub,
        organizationId: org.id,
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
