import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { AppliancesController } from './appliances/appliances.controller';
import { AppliancesService } from './appliances/appliances.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ChecklistsController } from './checklists/checklists.controller';
import { ChecklistsService } from './checklists/checklists.service';
import { FaultCodesController } from './fault-codes/fault-codes.controller';
import { FaultCodesService } from './fault-codes/fault-codes.service';
import { FieldBillingController } from './field-billing/field-billing.controller';
import { FieldBillingService } from './field-billing/field-billing.service';
import { JobCardsController } from './job-cards/job-cards.controller';
import { JobCardsService } from './job-cards/job-cards.service';
import { RepairNotificationListener } from './repair.notification-listener';
import { RepairAccessService } from './repair-access.service';
import { RepairEventsService } from './repair-events.service';
import { WarrantyController } from './warranty/warranty.controller';
import { WarrantyService } from './warranty/warranty.service';
import { WorkshopController } from './workshop/workshop.controller';
import { WorkshopService } from './workshop/workshop.service';

/**
 * Repair domain — customer appliances, service catalog, fault codes,
 * checklists, technician job cards, warranty claims and workshop
 * (pickup/drop, carry-in) jobs, plus technician-scoped field billing. Mounted under `/v1/repair/*`.
 */
@Module({
  imports: [BookingsModule, NotificationsModule, InvoicesModule, PaymentsModule, QuotationsModule],
  controllers: [
    AppliancesController,
    CatalogController,
    FaultCodesController,
    ChecklistsController,
    JobCardsController,
    WarrantyController,
    WorkshopController,
    FieldBillingController,
  ],
  providers: [
    RepairAccessService,
    RepairEventsService,
    RepairNotificationListener,
    AppliancesService,
    CatalogService,
    FaultCodesService,
    ChecklistsService,
    JobCardsService,
    WarrantyService,
    WorkshopService,
    FieldBillingService,
  ],
  exports: [AppliancesService, ChecklistsService, WorkshopService],
})
export class RepairModule {}
