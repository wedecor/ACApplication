import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CreateTaskDto, ListTasksDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('productivity')
@ApiBearerAuth()
@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermissions(Permission.TASK_VIEW)
  @ApiOperation({ summary: 'List tasks (mine/all, overdue, by linked entity).' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListTasksDto) {
    const { items, total } = await this.tasks.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Get('summary')
  @RequirePermissions(Permission.TASK_VIEW)
  @ApiOperation({ summary: 'Task counters: open, overdue, due today, mine.' })
  summary(@CurrentUser() actor: AuthPrincipal) {
    return this.tasks.summary(actor);
  }

  @Post()
  @RequirePermissions(Permission.TASK_MANAGE)
  @ApiOperation({ summary: 'Create a task.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateTaskDto) {
    return this.tasks.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.TASK_VIEW)
  @ApiOperation({ summary: 'Get a task.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TASK_MANAGE)
  @ApiOperation({ summary: 'Update a task.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(actor, id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions(Permission.TASK_MANAGE)
  @ApiOperation({ summary: 'Mark a task done.' })
  complete(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.complete(actor, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TASK_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a task.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.remove(actor, id);
  }
}
