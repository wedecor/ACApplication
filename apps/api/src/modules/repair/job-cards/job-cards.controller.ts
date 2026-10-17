import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { buildPaginationMeta } from '../../../common/dto/pagination.dto';
import { CompleteJobCardDto, ListJobCardsDto, UpsertJobCardDto } from './dto/job-card.dto';
import { JobCardsService } from './job-cards.service';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/job-cards', version: '1' })
export class JobCardsController {
  constructor(private readonly jobCards: JobCardsService) {}

  @Get()
  @RequirePermissions(Permission.JOBCARD_VIEW)
  @ApiOperation({ summary: 'List job cards (technicians only see their own).' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListJobCardsDto) {
    const { items, total } = await this.jobCards.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Get('by-booking/:bookingId')
  @RequirePermissions(Permission.JOBCARD_VIEW)
  @ApiOperation({
    summary: 'Job card for a booking: { jobCard | null, templates, booking }.',
  })
  getByBooking(@CurrentUser() actor: AuthPrincipal, @Param('bookingId') bookingId: string) {
    return this.jobCards.getByBooking(actor, bookingId);
  }

  @Put('by-booking/:bookingId')
  @RequirePermissions(Permission.JOBCARD_WRITE)
  @ApiOperation({
    summary: 'Create or partially update the job card (first write starts it).',
  })
  upsert(
    @CurrentUser() actor: AuthPrincipal,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpsertJobCardDto,
  ) {
    return this.jobCards.upsert(actor, bookingId, dto);
  }

  @Post('by-booking/:bookingId/complete')
  @RequirePermissions(Permission.JOBCARD_WRITE)
  @ApiOperation({ summary: 'Complete the job card (required checklist items must be answered).' })
  complete(
    @CurrentUser() actor: AuthPrincipal,
    @Param('bookingId') bookingId: string,
    @Body() dto: CompleteJobCardDto,
  ) {
    return this.jobCards.complete(actor, bookingId, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.JOBCARD_VIEW)
  @ApiOperation({ summary: 'Get a job card by id (with booking summary and templates).' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.jobCards.getById(actor, id);
  }
}
