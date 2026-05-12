import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ClerkUserData {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromClerk(data: ClerkUserData) {
    const email = data.emailAddresses[0]?.emailAddress ?? '';
    const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || email;

    return this.prisma.user.upsert({
      where: { clerkUserId: data.id },
      update: { email, name, avatarUrl: data.imageUrl },
      create: { clerkUserId: data.id, email, name, avatarUrl: data.imageUrl },
    });
  }

  async findByClerkId(clerkUserId: string) {
    return this.prisma.user.findUnique({ where: { clerkUserId } });
  }
}
