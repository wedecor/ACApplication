import { Module } from '@nestjs/common';

import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

/**
 * Customer ledger — central read/write surface for every financial event.
 *
 * Re-used by Invoice / Payment / Refund / Credit-Note / AMC modules to
 * post the canonical "+X owed by customer" or "−X received from customer"
 * entry. Statement export and balance lookup live here too.
 */
@Module({
  providers: [LedgerService],
  controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}
