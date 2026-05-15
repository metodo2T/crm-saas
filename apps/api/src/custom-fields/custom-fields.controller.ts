import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg, CurrentUser } from '../auth/decorators';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

@Controller('custom-fields')
@UseGuards(ClerkAuthGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query('entity') entity: 'LEAD' | 'DEAL',
  ) {
    if (entity !== 'LEAD' && entity !== 'DEAL') {
      throw new BadRequestException('entity must be LEAD or DEAL');
    }
    return this.customFieldsService.findAll(orgId, entity);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldsService.create(orgId, userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldsService.update(orgId, userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.remove(orgId, userId, id);
  }
}
