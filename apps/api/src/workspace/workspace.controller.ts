import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';

@Controller('workspace')
@UseGuards(ClerkAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  getWorkspace(@CurrentOrg() orgId: string) {
    return this.workspaceService.getWorkspace(orgId);
  }

  @Patch()
  updateWorkspace(@CurrentOrg() orgId: string, @Body() body: { name?: string; logoUrl?: string }) {
    return this.workspaceService.updateWorkspace(orgId, body);
  }

  @Get('members')
  getMembers(@CurrentOrg() orgId: string) {
    return this.workspaceService.getMembers(orgId);
  }

  @Delete('members/:userId')
  removeMember(@CurrentOrg() orgId: string, @Param('userId') userId: string) {
    return this.workspaceService.removeMember(orgId, userId);
  }
}
