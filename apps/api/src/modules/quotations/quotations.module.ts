import { Module } from '@nestjs/common';

import { InvoicesModule } from '../invoices/invoices.module';
import { PdfModule } from '../pdf/pdf.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [InvoicesModule, PdfModule],
  providers: [QuotationsService],
  controllers: [QuotationsController],
  exports: [QuotationsService],
})
export class QuotationsModule {}
