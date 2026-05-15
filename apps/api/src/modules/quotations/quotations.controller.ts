import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { ListQuotationsDto } from './dto/list-quotations.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@ApiBearerAuth()
@Controller({ path: 'quotations', version: '1' })
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Post()
  @RequirePermissions(Permission.QUOTATION_CREATE)
  @ApiOperation({ summary: 'Create a quotation draft.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateQuotationDto) {
    return this.quotations.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.QUOTATION_VIEW)
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListQuotationsDto) {
    const result = await this.quotations.list(actor, dto);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.page, result.pageSize, result.total),
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.QUOTATION_VIEW)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.quotations.get(actor, id);
  }

  @Post(':id/send')
  @RequirePermissions(Permission.QUOTATION_SEND)
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.quotations.send(actor, id);
  }

  @Post(':id/convert')
  @RequirePermissions(Permission.QUOTATION_CONVERT, Permission.INVOICE_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert a quotation to an invoice.' })
  convert(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.quotations.convertToInvoice(actor, id);
  }

  @Post(':id/download-pdf')
  @RequirePermissions(Permission.QUOTATION_VIEW)
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { buffer, hash } = await this.quotations.renderPdf(actor, id);
    reply.header('Content-Disposition', `attachment; filename="quotation-${id}.pdf"`);
    reply.header('X-Pdf-Sha256', hash);
    return buffer;
  }

  // -------- Public customer-facing actions (no auth) --------

  @Get('public/:viewToken')
  @Public()
  @ApiOperation({ summary: 'Customer-facing view of a quotation.' })
  publicView(@Param('viewToken') viewToken: string) {
    return this.quotations.getByViewToken(viewToken);
  }

  @Post('public/:viewToken/approve')
  @Public()
  @HttpCode(HttpStatus.OK)
  publicApprove(@Param('viewToken') viewToken: string) {
    return this.quotations.customerApprove(viewToken);
  }

  @Post('public/:viewToken/reject')
  @Public()
  @HttpCode(HttpStatus.OK)
  publicReject(@Param('viewToken') viewToken: string, @Body() body: { reason?: string }) {
    return this.quotations.customerReject(viewToken, body.reason);
  }
}
