import { api } from './api';

export type TechnicianStockStatus =
  | 'ALLOCATED'
  | 'ACKNOWLEDGED'
  | 'USED'
  | 'RETURNED'
  | 'RECONCILED'
  | 'PARTIAL_RETURN';

export type InventoryUnit =
  | 'PIECE'
  | 'BOX'
  | 'PACK'
  | 'LITRE'
  | 'METER'
  | 'KG'
  | 'SET';

export interface VanInventoryRow {
  id: string;
  status: TechnicianStockStatus;
  allocatedQty: number;
  usedQty: number;
  returnedQty: number;
  remainingQty: number;
  acknowledgedAt: string | null;
  allocatedAt: string;
  bookingId: string | null;
  notes: string | null;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: InventoryUnit;
    sellingPriceMinor: number;
  };
}

export interface InventoryItemLookup {
  id: string;
  sku: string;
  barcode: string | null;
  qrCode: string;
  name: string;
  brand: string | null;
  unit: InventoryUnit;
  costPriceMinor: number;
  sellingPriceMinor: number;
}

export const inventoryApi = {
  vanInventory: (technicianId: string) =>
    api<VanInventoryRow[]>(`/inventory/technician/van/${technicianId}`),
  lookup: (code: string) =>
    api<InventoryItemLookup | null>('/inventory/items/lookup', { query: { code } }),
  acknowledge: (allocationId: string) =>
    api<{ ok: true }>(`/inventory/technician/${allocationId}/acknowledge`, {
      method: 'POST',
    }),
  use: (
    allocationId: string,
    body: { usedQty: number; bookingId?: string; notes?: string },
  ) =>
    api<{ ok: true }>(`/inventory/technician/${allocationId}/use`, {
      method: 'POST',
      body,
    }),
  returnStock: (
    allocationId: string,
    body: { returnedQty: number; notes?: string },
  ) =>
    api<{ ok: true }>(`/inventory/technician/${allocationId}/return`, {
      method: 'POST',
      body,
    }),
};
