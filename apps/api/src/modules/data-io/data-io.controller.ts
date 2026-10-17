import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { DataExportService } from './data-export.service';
import { DataImportService } from './data-import.service';
import { ExportQueryDto, ImportCsvDto } from './dto/data-io.dto';

@ApiTags('data-io')
@ApiBearerAuth()
@Controller({ path: 'data', version: '1' })
export class DataIoController {
  constructor(
    private readonly exporter: DataExportService,
    private readonly importer: DataImportService,
  ) {}

  @Get('export/:entity')
  @RequirePermissions(Permission.DATA_EXPORT)
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Stream a CSV export (customers|leads|bookings|invoices|appliances|tasks).',
  })
  export(
    @CurrentUser() actor: AuthPrincipal,
    @Param('entity') entity: string,
    @Query() query: ExportQueryDto,
    @Res() reply: FastifyReply,
  ) {
    // Throws BadRequest for unknown entities before any header is written.
    const stream = this.exporter.stream(actor.tenantId, entity, query);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${this.exporter.filename(entity)}"`)
      .header('cache-control', 'no-store')
      .send(stream);
  }

  @Get('import/:entity/template')
  @RequirePermissions(Permission.DATA_IMPORT)
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Download a CSV import template (customers|leads|appliances).' })
  template(@Param('entity') entity: string, @Res() reply: FastifyReply) {
    const body = this.importer.template(entity);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${entity}-import-template.csv"`)
      .send(body);
  }

  @Post('import/:entity')
  @RequirePermissions(Permission.DATA_IMPORT)
  @ApiOperation({
    summary: 'Import CSV rows (customers|leads|appliances). dryRun=true validates only.',
  })
  import(
    @CurrentUser() actor: AuthPrincipal,
    @Param('entity') entity: string,
    @Body() dto: ImportCsvDto,
  ) {
    return this.importer.run(actor.tenantId, actor.userId, entity, dto.csv, dto.dryRun);
  }
}
