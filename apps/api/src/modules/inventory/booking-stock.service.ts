/**
 * Booking ↔ Inventory bridge.
 *
 * Two integration entry points are exposed for the bookings + dispatch
 * modules without polluting the inventory module with booking knowledge:
 *
 *   - `reserveForBooking()` — called by the bookings service when a parts
 *     list is attached to a booking. Calls into the ledger to RESERVE the
 *     parts at the closest warehouse. Idempotent via an `externalRef`
 *     derived from `(bookingId, itemId)`.
 *
 *   - `consumeFromTechnician()` — convenience helper for the booking-
 *     completion path: turns a list of `{ allocationId, qty }` tuples into
 *     ledger usage rows by delegating to `TechnicianInventoryService`.
 *
 * Both methods are safe to call multiple times (idempotent on the ledger
 * externalRef); the booking module can re-run them after a websocket
 * disconnect without doubling up.
 */

import { Injectable } from '@nestjs/common';

import { InventoryItemsService } from './inventory-items.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { TechnicianInventoryService } from './technician-inventory.service';

export interface ReserveForBookingInput {
  tenantId: string;
  bookingId: string;
  warehouseId: string;
  parts: Array<{ itemId: string; quantity: number }>;
}

export interface ReleaseForBookingInput {
  tenantId: string;
  bookingId: string;
  warehouseId: string;
  parts: Array<{ itemId: string; quantity: number }>;
}

export interface ConsumeFromTechnicianInput {
  bookingId: string;
  allocations: Array<{ allocationId: string; usedQty: number }>;
  invoiceId?: string | null;
}

@Injectable()
export class BookingStockService {
  constructor(
    private readonly items: InventoryItemsService,
    private readonly _ledger: InventoryLedgerService, // reserved for future audit writes
    private readonly tech: TechnicianInventoryService,
  ) {
    void this._ledger;
  }

  /** Reserve parts at warehouse `warehouseId` for the given booking. */
  async reserveForBooking(input: ReserveForBookingInput) {
    const results: Array<{ itemId: string; runningQuantity: number; runningReserved: number }> = [];
    for (const part of input.parts) {
      const r = await this.items.reserve(
        input.tenantId,
        input.warehouseId,
        part.itemId,
        part.quantity,
        `booking:${input.bookingId}:reserve:${part.itemId}`,
        input.bookingId,
      );
      results.push({
        itemId: part.itemId,
        runningQuantity: r.runningQuantity,
        runningReserved: r.runningReserved,
      });
    }
    return results;
  }

  /** Release reservations (e.g. booking cancelled before completion). */
  async releaseForBooking(input: ReleaseForBookingInput) {
    const results: Array<{ itemId: string; runningQuantity: number; runningReserved: number }> = [];
    for (const part of input.parts) {
      const r = await this.items.releaseReservation(
        input.tenantId,
        input.warehouseId,
        part.itemId,
        part.quantity,
        `booking:${input.bookingId}:release:${part.itemId}`,
        input.bookingId,
      );
      results.push({
        itemId: part.itemId,
        runningQuantity: r.runningQuantity,
        runningReserved: r.runningReserved,
      });
    }
    return results;
  }

  /**
   * Convenience for the booking-completion path: record usage against a
   * technician's outstanding allocations. The actor identity comes from
   * the calling service (the bookings module). The current AuthPrincipal
   * has already been validated upstream.
   */
  async consumeFromTechnician(
    actor: { tenantId: string; userId: string },
    input: ConsumeFromTechnicianInput,
  ) {
    for (const item of input.allocations) {
      await this.tech.recordUsage(actor as never, item.allocationId, {
        usedQty: item.usedQty,
        bookingId: input.bookingId,
      });
    }
  }
}
