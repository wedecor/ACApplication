import { Module } from '@nestjs/common';

import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [InvoicesModule],
  providers: [PaymentsService, RazorpayProvider, StripeProvider],
  controllers: [PaymentsController],
  exports: [PaymentsService, RazorpayProvider, StripeProvider],
})
export class PaymentsModule {}
