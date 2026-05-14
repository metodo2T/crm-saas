import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealDto } from './dto/move-deal.dto';

@Controller('deals')
@UseGuards(ClerkAuthGuard)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  findAll(
    @CurrentOrg() orgId: string,
    @Query('stageId') stageId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dealsService.findAll(orgId, {
      stageId, assignedTo, search,
      page: page ? (parseInt(page, 10) || 1) : 1,
      limit: limit ? (parseInt(limit, 10) || 20) : 20,
    });
  }

  @Get(':id')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.dealsService.findOne(orgId, id);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: CreateDealDto) {
    return this.dealsService.create(orgId, dto);
  }

  @Patch(':id')
  update(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.dealsService.update(orgId, id, dto);
  }

  @Patch(':id/move')
  move(@CurrentOrg() orgId: string, @Param('id') id: string, @Body() dto: MoveDealDto) {
    return this.dealsService.move(orgId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.dealsService.remove(orgId, id);
  }
}
