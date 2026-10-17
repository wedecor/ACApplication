import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { LeadsModule } from '../leads/leads.module';
import { ProductivityModule } from '../productivity/productivity.module';
import { DataExportService } from './data-export.service';
import { DataImportService } from './data-import.service';
import { DataIoController } from './data-io.controller';

/** CSV export (streaming) + validated CSV import with dry-run reports. */
@Module({
  imports: [CustomersModule, LeadsModule, ProductivityModule],
  controllers: [DataIoController],
  providers: [DataExportService, DataImportService],
})
export class DataIoModule {}
