import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create-link')
  @RequirePermissions(Permission.PAYMENT_MANAGE)
  @ApiOperation({ summary: 'Create a hosted payment link for an invoice.' })
  createLink(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreatePaymentLinkDto) {
    return this.payments.createPaymentLink(actor, dto);
  }

  @Get('history')
  @RequirePermissions(Permission.PAYMENT_VIEW)
  async history(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListPaymentsDto) {
    const result = await this.payments.list(actor, dto);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.page, result.pageSize, result.total),
    };
  }

  @Post('refund/:paymentId')
  @RequirePermissions(Permission.PAYMENT_REFUND)
  refundPayment(
    @CurrentUser() actor: AuthPrincipal,
    @Param('paymentId') paymentId: string,
    @Body() body: { amountMinor: number; reason?: string },
  ) {
    return this.payments.refundPayment(actor, paymentId, body.amountMinor, body.reason);
  }

  // -------- Webhooks (no auth — verified by signature) --------

  @Post('webhook/razorpay')
  @Public()
  @HttpCode(HttpStatus.OK)
  async razorpayWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer | string },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const raw = req.rawBody?.toString?.() ?? JSON.stringify(req.body);
    return this.payments.handleRazorpayWebhook(raw, signature);
  }

  @Post('webhook/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer | string },
    @Headers('stripe-signature') signature: string,
  ) {
    const raw = req.rawBody?.toString?.() ?? JSON.stringify(req.body);
    return this.payments.handleStripeWebhook(raw, signature);
  }
}
