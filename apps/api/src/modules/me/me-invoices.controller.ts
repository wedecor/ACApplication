import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';

import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { ConfirmMyInvoicePaymentDto, InvoicePdfQueryDto, PayMyInvoiceDto } from './dto/me-payments.dto';
import { MeInvoicesService } from './me-invoices.service';
import { MePaymentMethodsService } from './me-payment-methods.service';

@ApiTags('me:invoices')
@ApiBearerAuth()
@Controller({ path: 'me/invoices', version: '1' })
export class MeInvoicesController {
  constructor(private readonly svc: MeInvoicesService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'List my invoices.' })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.list(actor);
  }

  @Get(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'My invoice with line items and a signed PDF link.' })
  detail(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.detail(actor, id);
  }

  @Post(':id/pay')
  @RequirePermissions(Permission.SELF_SERVICE)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start a hosted checkout (Razorpay / Stripe) for my invoice.' })
  pay(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: PayMyInvoiceDto) {
    return this.svc.pay(actor, id, dto);
  }

  @Post(':id/pay/confirm')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Report invoice payment state after the hosted checkout returns.' })
  confirm(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ConfirmMyInvoicePaymentDto,
  ) {
    return this.svc.confirm(actor, id, dto);
  }

  @Public()
  @Get(':id/pdf')
  @Throttle({ global: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Download an invoice PDF via a signed, expiring link (no bearer needed).' })
  async pdf(@Param('id') id: string, @Query() q: InvoicePdfQueryDto, @Res() reply: FastifyReply) {
    const { buffer, hash } = await this.svc.renderSignedPdf(id, q.t, q.exp, q.sig);
    await reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="invoice-${id}.pdf"`)
      .header('X-Pdf-Sha256', hash)
      .header('Cache-Control', 'private, no-store')
      .send(buffer);
  }
}

@ApiTags('me:payments')
@ApiBearerAuth()
@Controller({ path: 'me/payment-methods', version: '1' })
export class MePaymentMethodsController {
  constructor(private readonly svc: MePaymentMethodsService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'List my saved (tokenised) payment methods.' })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.list(actor);
  }

  @Get('refunds')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'List refunds issued to me.' })
  refunds(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.refunds(actor);
  }

  @Post(':id/default')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Make a saved payment method my default.' })
  setDefault(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.setDefault(actor, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Remove a saved payment method.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.remove(actor, id);
  }
}
