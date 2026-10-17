import { Module } from '@nestjs/common';

import { ProductivityModule } from '../productivity/productivity.module';
import { CustomerStatsService } from './customer-stats.service';
import { CustomersController } from './customers.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

@Module({
  imports: [ProductivityModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersRepository, CustomerStatsService],
  exports: [CustomersService, CustomersRepository, CustomerStatsService],
})
export class CustomersModule {}
