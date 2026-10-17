import type { AuthPrincipal } from '@ac/auth';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowAuthenticated, CurrentUser } from '../../../common/decorators';
import { RecordFieldPaymentDto } from './dto/field-billing.dto';
import { FieldBillingService } from './field-billing.service';

/**
 * Technician field billing. The global guard only supports ALL-of
 * permissions, so these routes are `@AllowAuthenticated()` and
 * FieldBillingService.assertAccess enforces the ANY-of rule on every call:
 * an assigned field technician holding JOBCARD_WRITE, or staff holding the
 * operation's permissions (see FIELD_BILLING_STAFF_PERMISSIONS).
 */
@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/field-billing', version: '1' })
export class FieldBillingController {
  constructor(private readonly billing: FieldBillingService) {}

  @Get(':bookingId')
  @AllowAuthenticated()
  @ApiOperation({
    summary:
      'Billing summary for a booking: invoice, quotation, payments, payment link. Assigned technician (jobcard:write) or staff (invoice:view).',
  })
  summary(@CurrentUser() actor: AuthPrincipal, @Param('bookingId') bookingId: string) {
    return this.billing.summary(actor, bookingId);
  }

  @Post(':bookingId/invoice')
  @AllowAuthenticated()
  @ApiOperation({
    summary:
      'Raise the invoice for a booking (idempotent; converts an approved quotation). Assigned technician or staff (booking:read + invoice:create).',
  })
  createInvoice(@CurrentUser() actor: AuthPrincipal, @Param('bookingId') bookingId: string) {
    return this.billing.createInvoice(actor, bookingId);
  }

  @Post(':bookingId/payments')
  @AllowAuthenticated()
  @ApiOperation({
    summary:
      'Record a cash / UPI / card payment against the booking invoice. Assigned technician or staff (booking:read + payment:manage).',
  })
  recordPayment(
    @CurrentUser() actor: AuthPrincipal,
    @Param('bookingId') bookingId: string,
    @Body() dto: RecordFieldPaymentDto,
  ) {
    return this.billing.recordPayment(actor, bookingId, dto);
  }

  @Post(':bookingId/payment-link')
  @AllowAuthenticated()
  @ApiOperation({
    summary:
      'Create or reuse a payment link for the amount due. Assigned technician or staff (booking:read + payment:manage).',
  })
  paymentLink(@CurrentUser() actor: AuthPrincipal, @Param('bookingId') bookingId: string) {
    return this.billing.paymentLink(actor, bookingId);
  }

  @Post(':bookingId/quotation/send')
  @AllowAuthenticated()
  @ApiOperation({
    summary:
      "Send the booking's quotation to the customer. Assigned technician or staff (booking:read + quotation:send).",
  })
  sendQuotation(@CurrentUser() actor: AuthPrincipal, @Param('bookingId') bookingId: string) {
    return this.billing.sendQuotation(actor, bookingId);
  }
}
