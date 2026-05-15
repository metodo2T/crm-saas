import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BaseService } from '../common/base.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CustomFieldsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findAll(organizationId: string, entity: 'LEAD' | 'DEAL') {
    return this.prisma.customFieldDef.findMany({
      where: { organizationId, entity },
      orderBy: { order: 'asc' },
    });
  }

  async create(organizationId: string, userId: string, dto: CreateCustomFieldDto) {
    await this.requireAdmin(organizationId, userId);
    const slug = toSlug(dto.name);
    const existing = await this.prisma.customFieldDef.findMany({
      where: { organizationId, entity: dto.entity },
    });
    return this.prisma.customFieldDef.create({
      data: {
        organizationId,
        entity: dto.entity,
        name: dto.name,
        slug,
        type: dto.type,
        options: dto.options ?? Prisma.JsonNull,
        order: existing.length,
      },
    });
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateCustomFieldDto) {
    await this.requireAdmin(organizationId, userId);
    await this.findOne(organizationId, id);
    return this.prisma.customFieldDef.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.requireAdmin(organizationId, userId);
    await this.findOne(organizationId, id);
    return this.prisma.customFieldDef.delete({ where: { id } });
  }

  private async findOne(organizationId: string, id: string) {
    const field = await this.prisma.customFieldDef.findFirst({ where: { id, organizationId } });
    if (!field) throw new NotFoundException('Custom field not found');
    return field;
  }

  private async requireAdmin(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }
}
