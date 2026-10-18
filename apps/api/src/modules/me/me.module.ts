import { Module } from '@nestjs/common';

import { StorageModule } from '../../common/storage/storage.module';
import { AmcModule } from '../amc/amc.module';
import { BookingsModule } from '../bookings/bookings.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SupportModule } from '../support/support.module';
import { MeAccountService } from './me-account.service';
import { MeAddressesService } from './me-addresses.service';
import { MeAmcService } from './me-amc.service';
import { MeAppliancesService } from './me-appliances.service';
import { MeBookingsController } from './me-bookings.controller';
import { MeBookingsService } from './me-bookings.service';
import { MeContextService } from './me-context.service';
import { MeInvoicesController, MePaymentMethodsController } from './me-invoices.controller';
import { MeInvoicesService } from './me-invoices.service';
import { MeNotificationsService } from './me-notifications.service';
import { MePaymentMethodsService } from './me-payment-methods.service';
import {
  MeAddressesController,
  MeAmcController,
  MeAppliancesController,
  MeDevicesController,
  MeNotificationsController,
  MeUploadsController,
  StaffUploadsController,
  SupportFaqsController,
} from './me-profile.controller';
import { PublicRatingsController } from './public-ratings.controller';
import { PublicRatingsService } from './public-ratings.service';

/**
 * Customer self-service surface (`/v1/me/*`) consumed by the customer app,
 * plus the shared `/v1/uploads/presign` (staff) and public `/v1/support/faqs`.
 * All `/me` routes require `self:service` and scope every query to the
 * caller's Customer row.
 */
@Module({
  imports: [
    BookingsModule,
    AmcModule,
    InvoicesModule,
    PaymentsModule,
    NotificationsModule,
    SupportModule,
    StorageModule,
  ],
  controllers: [
    MeBookingsController,
    PublicRatingsController,
    MeInvoicesController,
    MePaymentMethodsController,
    MeAmcController,
    MeNotificationsController,
    MeAddressesController,
    MeAppliancesController,
    MeDevicesController,
    MeUploadsController,
    StaffUploadsController,
    SupportFaqsController,
  ],
  providers: [
    MeContextService,
    PublicRatingsService,
    MeBookingsService,
    MeInvoicesService,
    MePaymentMethodsService,
    MeAmcService,
    MeNotificationsService,
    MeAddressesService,
    MeAppliancesService,
    MeAccountService,
  ],
  exports: [MeContextService],
})
export class MeModule {}
