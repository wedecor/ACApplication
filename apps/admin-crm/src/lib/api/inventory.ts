/**
 * Admin CRM ↔ Inventory API client.
 *
 * Each function is a thin wrapper around `apiFetch` that knows the response
 * shape. Mutating functions return the same envelope as the API and rely on
 * React Query to invalidate caches via `queryKeys.inventory`.
 */
import { apiFetch } from './client';

// ---------------------------------------------------------------------- types

export type InventoryItemType = 'SPARE_PART' | 'APPLIANCE' | 'CONSUMABLE' | 'TOOL' | 'ACCESSORY';
export type InventoryUnit =
  | 'PIECE'
  | 'SET'
  | 'BOX'
  | 'METER'
  | 'KILOGRAM'
  | 'LITRE'
  | 'PACK';

export interface InventoryItem {
  id: string;
  sku: string;
  barcode: string | null;
  qrCode: string;
  name: string;
  description: string | null;
  type: InventoryItemType;
  category: string | null;
  brand: string | null;
  unit: InventoryUnit;
  costPriceMinor: number;
  sellingPriceMinor: number;
  gstRateBps: number;
  hsnCode: string | null;
  serialTracking: boolean;
  batchTracking: boolean;
  shelfLifeDays: number | null;
  warrantyDays: number | null;
  preferredVendorId: string | null;
  defaultReorderLevel: number;
  defaultReorderQty: number;
  isActive: boolean;
  compatibleApplianceCategories: string[];
  compatibleBrands: string[];
  totalQuantity?: number;
  totalReserved?: number;
  available?: number;
  lowStock?: boolean;
  valuationMinor?: number;
  stocks?: Array<{
    id: string;
    warehouseId: string;
    quantity: number;
    reservedQuantity: number;
    reorderLevel: number | null;
    reorderQty: number | null;
    avgCostMinor: number;
    warehouse?: { id: string; name: string; code: string };
  }>;
}

export type WarehouseKind = 'CENTRAL' | 'BRANCH' | 'TRANSIT' | 'VENDOR_RETURNS' | 'SCRAP';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  kind: WarehouseKind;
  cityId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  pincode: string | null;
  state: string | null;
  gstin: string | null;
  managerUserId: string | null;
  isActive: boolean;
  _count?: { stocks?: number; zones?: number };
}

export type VendorStatus = 'ACTIVE' | 'BLACKLISTED' | 'ON_HOLD' | 'PROSPECT';

export interface Vendor {
  id: string;
  code: string;
  companyName: string;
  legalName: string | null;
  gstin: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city?: string | null;
  state?: string | null;
  paymentTermsDays: number;
  categoriesSupplied: string[];
  rating: number;
  onTimeRate: number;
  lifetimeSpendMinor: number;
  status: VendorStatus;
  _count?: { purchaseOrders?: number };
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

export interface PurchaseOrderItemPayload {
  id?: string;
  itemId: string;
  description: string | null;
  quantity: number;
  receivedQty: number;
  unitCostMinor: number;
  gstRateBps: number;
  totalMinor: number;
  item?: { id: string; sku: string; name: string };
}

export interface PurchaseOrder {
  id: string;
  number: string;
  vendorId: string;
  warehouseId: string;
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  subtotalMinor: number;
  taxMinor: number;
  shippingMinor: number;
  discountMinor: number;
  totalMinor: number;
  paymentTermsDays: number;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  vendor?: Pick<Vendor, 'id' | 'companyName' | 'code'>;
  warehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>;
  items?: PurchaseOrderItemPayload[];
  receipts?: Array<{
    id: string;
    number: string;
    receivedAt: string;
    items: Array<{
      id: string;
      itemId: string;
      quantity: number;
      unitCostMinor: number;
      item?: { id: string; sku: string; name: string };
    }>;
  }>;
}

export type StockTransferStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'REJECTED';

export interface StockTransfer {
  id: string;
  number: string;
  status: StockTransferStatus;
  sourceWarehouseId: string;
  destWarehouseId: string;
  requestedAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  sourceWarehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>;
  destWarehouse?: Pick<Warehouse, 'id' | 'name' | 'code'>;
  items?: Array<{
    id: string;
    itemId: string;
    requestedQty: number;
    dispatchedQty: number;
    receivedQty: number;
    item?: { id: string; sku: string; name: string };
  }>;
}

export interface InventoryAlert {
  id: string;
  kind: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SNOOZED';
  itemId: string | null;
  warehouseId: string | null;
  title: string;
  observedValue: number | null;
  thresholdValue: number | null;
  createdAt: string;
  item?: { id: string; sku: string; name: string };
}

// ---------------------------------------------------------------------- API

export interface PaginatedEnvelope<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const inventoryItemsApi = {
  list: (params: Record<string, unknown>) =>
    apiFetch<PaginatedEnvelope<InventoryItem>>('/inventory/items', { query: params as Record<string, string | number | boolean | string[] | undefined> }),
  get: (id: string) => apiFetch<InventoryItem>(`/inventory/items/${id}`),
  lookup: (code: string) =>
    apiFetch<{ id: string; sku: string; name: string; barcode: string | null } | null>(
      `/inventory/items/lookup`,
      { query: { code } },
    ),
  create: (body: Partial<InventoryItem>) =>
    apiFetch<InventoryItem>('/inventory/items', { method: 'POST', body }),
  update: (id: string, body: Partial<InventoryItem>) =>
    apiFetch<InventoryItem>(`/inventory/items/${id}`, { method: 'PATCH', body }),
  delete: (id: string) =>
    apiFetch<{ ok: true }>(`/inventory/items/${id}`, { method: 'DELETE' }),
  adjust: (body: {
    warehouseId: string;
    itemId: string;
    quantity: number;
    reason: string;
    unitCostMinor?: number;
    externalRef?: string;
  }) => apiFetch<{ id: string; runningQuantity: number }>('/inventory/items/adjust', {
    method: 'POST',
    body,
  }),
  ledger: (id: string, params: { warehouseId?: string; limit?: number; cursor?: string }) =>
    apiFetch<Array<{
      id: string;
      kind: string;
      quantityDelta: number;
      runningQuantity: number;
      occurredAt: string;
      description: string | null;
    }>>(`/inventory/items/${id}/ledger`, { query: params as Record<string, string | number | boolean | string[] | undefined> }),
};

const warehousesApi = {
  list: (params: Record<string, unknown>) =>
    apiFetch<PaginatedEnvelope<Warehouse>>('/inventory/warehouses', { query: params as Record<string, string | number | boolean | string[] | undefined> }),
  get: (id: string) => apiFetch<Warehouse>(`/inventory/warehouses/${id}`),
  stats: (id: string) =>
    apiFetch<{
      warehouseId: string;
      skuCount: number;
      totalQuantity: number;
      totalReserved: number;
      totalValuationMinor: number;
      lowStockCount: number;
    }>(`/inventory/warehouses/${id}/stats`),
  create: (body: Partial<Warehouse>) =>
    apiFetch<Warehouse>('/inventory/warehouses', { method: 'POST', body }),
  update: (id: string, body: Partial<Warehouse>) =>
    apiFetch<Warehouse>(`/inventory/warehouses/${id}`, { method: 'PATCH', body }),
};

const vendorsApi = {
  list: (params: Record<string, unknown>) =>
    apiFetch<PaginatedEnvelope<Vendor>>('/inventory/vendors', { query: params as Record<string, string | number | boolean | string[] | undefined> }),
  get: (id: string) => apiFetch<Vendor>(`/inventory/vendors/${id}`),
  create: (body: Partial<Vendor>) =>
    apiFetch<Vendor>('/inventory/vendors', { method: 'POST', body }),
  update: (id: string, body: Partial<Vendor>) =>
    apiFetch<Vendor>(`/inventory/vendors/${id}`, { method: 'PATCH', body }),
};

const purchaseOrdersApi = {
  list: (params: Record<string, unknown>) =>
    apiFetch<PaginatedEnvelope<PurchaseOrder>>('/inventory/purchase-orders', { query: params as Record<string, string | number | boolean | string[] | undefined> }),
  get: (id: string) => apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}`),
  create: (body: {
    vendorId: string;
    warehouseId: string;
    expectedAt?: string;
    notes?: string;
    items: Array<{ itemId: string; quantity: number; unitCostMinor: number; gstRateBps?: number }>;
  }) => apiFetch<PurchaseOrder>('/inventory/purchase-orders', { method: 'POST', body }),
  submit: (id: string) =>
    apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}/submit`, { method: 'POST' }),
  approve: (id: string) =>
    apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}/approve`, { method: 'POST' }),
  order: (id: string) =>
    apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}/order`, { method: 'POST' }),
  cancel: (id: string, reason?: string) =>
    apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
  receive: (
    id: string,
    body: {
      items: Array<{
        itemId: string;
        quantity: number;
        unitCostMinor?: number;
        batchNumber?: string;
        serialNumbers?: string[];
        expiryDate?: string;
      }>;
      notes?: string;
    },
  ) => apiFetch<{ grn: { id: string; number: string }; poStatus: PurchaseOrderStatus }>(
    `/inventory/purchase-orders/${id}/receipts`,
    { method: 'POST', body },
  ),
};

const transfersApi = {
  list: (params: Record<string, unknown>) =>
    apiFetch<PaginatedEnvelope<StockTransfer>>('/inventory/transfers', { query: params as Record<string, string | number | boolean | string[] | undefined> }),
  get: (id: string) => apiFetch<StockTransfer>(`/inventory/transfers/${id}`),
  create: (body: {
    sourceWarehouseId: string;
    destWarehouseId: string;
    notes?: string;
    items: Array<{ itemId: string; quantity: number }>;
  }) => apiFetch<StockTransfer>('/inventory/transfers', { method: 'POST', body }),
  approve: (id: string) =>
    apiFetch<StockTransfer>(`/inventory/transfers/${id}/approve`, { method: 'POST' }),
  dispatch: (id: string) =>
    apiFetch<StockTransfer>(`/inventory/transfers/${id}/dispatch`, { method: 'POST' }),
  receive: (
    id: string,
    body: { items: Array<{ transferItemId: string; receivedQty: number }>; notes?: string },
  ) => apiFetch<StockTransfer>(`/inventory/transfers/${id}/receive`, { method: 'POST', body }),
  reject: (id: string, reason?: string) =>
    apiFetch<StockTransfer>(`/inventory/transfers/${id}/reject`, {
      method: 'POST',
      body: { reason },
    }),
  cancel: (id: string, reason?: string) =>
    apiFetch<StockTransfer>(`/inventory/transfers/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
};

const alertsApi = {
  list: (params: Record<string, unknown>) =>
    apiFetch<PaginatedEnvelope<InventoryAlert>>('/inventory/alerts', { query: params as Record<string, string | number | boolean | string[] | undefined> }),
  acknowledge: (id: string) =>
    apiFetch<InventoryAlert>(`/inventory/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolve: (id: string) =>
    apiFetch<InventoryAlert>(`/inventory/alerts/${id}/resolve`, { method: 'POST' }),
  scan: () =>
    apiFetch<number>(`/inventory/alerts/scan/low-stock`, { method: 'POST' }),
};

const analyticsApi = {
  valuation: () =>
    apiFetch<{
      totalQuantity: number;
      totalValuationMinor: number;
      byWarehouse: Array<{
        warehouseId: string;
        code: string;
        name: string;
        quantity: number;
        valuationMinor: number;
      }>;
    }>('/inventory/analytics/valuation'),
  fastMoving: (params: { days?: number; limit?: number } = {}) =>
    apiFetch<
      Array<{
        itemId: string;
        unitsMoved: number;
        item: { id: string; sku: string; name: string; unit: string } | null;
      }>
    >('/inventory/analytics/fast-moving', { query: params as Record<string, string | number | boolean | undefined> }),
  deadStock: (params: { days?: number } = {}) =>
    apiFetch<
      Array<{
        item: { id: string; sku: string; name: string };
        warehouse: { id: string; code: string; name: string };
        quantity: number;
        valuationMinor: number;
        lastMovementAt: string | null;
      }>
    >('/inventory/analytics/dead-stock', { query: params as Record<string, string | number | boolean | undefined> }),
  turnover: (params: { days?: number } = {}) =>
    apiFetch<Array<{
      itemId: string;
      item: { id: string; sku: string; name: string } | null;
      cogsMinor: number;
      avgInventoryMinor: number;
      turnoverRatio: number | null;
    }>>('/inventory/analytics/turnover', { query: params as Record<string, string | number | boolean | undefined> }),
  procurementSpend: (params: { days?: number } = {}) =>
    apiFetch<
      Array<{
        vendor: { id: string; companyName: string; code: string };
        spendMinor: number;
        orders: number;
      }>
    >('/inventory/analytics/procurement-spend', { query: params as Record<string, string | number | boolean | undefined> }),
  technicianWastage: (params: { days?: number } = {}) =>
    apiFetch<
      Array<{
        technicianId: string;
        shortfallQty: number;
        shortfallValueMinor: number;
      }>
    >('/inventory/analytics/technician-wastage', { query: params as Record<string, string | number | boolean | undefined> }),
};

export const inventoryApi = {
  items: inventoryItemsApi,
  warehouses: warehousesApi,
  vendors: vendorsApi,
  purchaseOrders: purchaseOrdersApi,
  transfers: transfersApi,
  alerts: alertsApi,
  analytics: analyticsApi,
};
