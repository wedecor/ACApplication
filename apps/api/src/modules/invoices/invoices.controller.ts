import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { RefundInvoiceDto } from './dto/refund-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @RequirePermissions(Permission.INVOICE_CREATE)
  @ApiOperation({ summary: 'Create an invoice (with optional booking link).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.INVOICE_VIEW)
  @ApiOperation({ summary: 'List invoices for the current tenant.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListInvoicesDto) {
    const result = await this.invoices.list(actor, dto);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.page, result.pageSize, result.total),
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.INVOICE_VIEW)
  @ApiOperation({ summary: 'Get a single invoice with line items + payments.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.invoices.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVOICE_UPDATE)
  @ApiOperation({ summary: 'Edit an invoice (DRAFT only allows full edit).' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(actor, id, dto);
  }

  @Post(':id/send')
  @RequirePermissions(Permission.INVOICE_SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue the invoice — moves to SENT + writes ledger.' })
  send(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() _dto: SendInvoiceDto) {
    return this.invoices.send(actor, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.INVOICE_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invoice (cannot cancel if already settled).' })
  cancel(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.invoices.cancel(actor, id, body.reason);
  }

  @Post(':id/payments')
  @RequirePermissions(Permission.PAYMENT_MANAGE)
  @ApiOperation({ summary: 'Record a manual payment against an invoice.' })
  recordPayment(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoices.recordManualPayment(actor, id, dto);
  }

  @Post(':id/refund')
  @RequirePermissions(Permission.INVOICE_REFUND)
  @ApiOperation({ summary: 'Refund part / all of an invoice + optional credit note.' })
  refund(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: RefundInvoiceDto,
  ) {
    return this.invoices.refund(actor, id, dto);
  }

  @Post(':id/duplicate')
  @RequirePermissions(Permission.INVOICE_CREATE)
  @ApiOperation({ summary: 'Duplicate an existing invoice as a new draft.' })
  duplicate(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.invoices.duplicate(actor, id);
  }

  @Post(':id/download-pdf')
  @RequirePermissions(Permission.INVOICE_VIEW)
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Render & download the branded invoice PDF.' })
  async downloadPdf(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { buffer, hash } = await this.invoices.renderPdf(actor, id);
    reply.header('Content-Disposition', `attachment; filename="${id}.pdf"`);
    reply.header('X-Pdf-Sha256', hash);
    return buffer;
  }
}
