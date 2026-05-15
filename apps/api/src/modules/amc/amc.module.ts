import { Module } from '@nestjs/common';

import { InvoicesModule } from '../invoices/invoices.module';
import { PdfModule } from '../pdf/pdf.module';
import { AmcPlansService } from './amc-plans.service';
import { AmcSubscriptionsService } from './amc-subscriptions.service';
import { AmcController } from './amc.controller';

@Module({
  imports: [InvoicesModule, PdfModule],
  providers: [AmcPlansService, AmcSubscriptionsService],
  controllers: [AmcController],
  exports: [AmcPlansService, AmcSubscriptionsService],
})
export class AmcModule {}
