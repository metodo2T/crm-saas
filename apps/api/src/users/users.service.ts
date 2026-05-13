import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ClerkUserData {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromClerk(data: ClerkUserData) {
    const email = data.email_addresses?.[0]?.email_address;
    if (!email) throw new Error(`Clerk user ${data.id} has no email address`);
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || email;

    return this.prisma.user.upsert({
      where: { clerkUserId: data.id },
      update: { email, name, avatarUrl: data.image_url },
      create: { clerkUserId: data.id, email, name, avatarUrl: data.image_url },
    });
  }

  async findByClerkId(clerkUserId: string) {
    return this.prisma.user.findUnique({ where: { clerkUserId } });
  }
}
