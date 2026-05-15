'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { inventoryApi } from '@/lib/api/inventory';
import { queryKeys } from '@/lib/api/query-keys';

// ============================================================== INVENTORY ITEMS

export function useInventoryItems(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.items.list(params),
    queryFn: () => inventoryApi.items.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.inventory.items.detail(id) : ['inventory', 'items', 'noop'],
    queryFn: () => inventoryApi.items.get(id!),
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.items.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.items.all }),
  });
}

export function useUpdateInventoryItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof inventoryApi.items.update>[1]) =>
      inventoryApi.items.update(id, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.items.all }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.items.detail(id) }),
      ]),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.items.adjust,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.items.all }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses.all }),
      ]),
  });
}

// ============================================================== WAREHOUSES

export function useWarehouses(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.warehouses.list(params),
    queryFn: () => inventoryApi.warehouses.list(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useWarehouse(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.inventory.warehouses.detail(id) : ['inventory', 'warehouses', 'noop'],
    queryFn: () => inventoryApi.warehouses.get(id!),
    enabled: !!id,
  });
}

export function useWarehouseStats(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.inventory.warehouses.stats(id) : ['inventory', 'warehouses', 'noop-stats'],
    queryFn: () => inventoryApi.warehouses.stats(id!),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.warehouses.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses.all }),
  });
}

// ============================================================== VENDORS

export function useVendors(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.vendors.list(params),
    queryFn: () => inventoryApi.vendors.list(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useVendor(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.inventory.vendors.detail(id) : ['inventory', 'vendors', 'noop'],
    queryFn: () => inventoryApi.vendors.get(id!),
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.vendors.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.vendors.all }),
  });
}

// ============================================================== PURCHASE ORDERS

export function usePurchaseOrders(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.purchaseOrders.list(params),
    queryFn: () => inventoryApi.purchaseOrders.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: id
      ? queryKeys.inventory.purchaseOrders.detail(id)
      : ['inventory', 'purchase-orders', 'noop'],
    queryFn: () => inventoryApi.purchaseOrders.get(id!),
    enabled: !!id,
  });
}

export function usePurchaseOrderActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.inventory.purchaseOrders.all }),
      qc.invalidateQueries({ queryKey: queryKeys.inventory.purchaseOrders.detail(id) }),
      qc.invalidateQueries({ queryKey: queryKeys.inventory.items.all }),
    ]);
  return {
    submit: useMutation({
      mutationFn: () => inventoryApi.purchaseOrders.submit(id),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: () => inventoryApi.purchaseOrders.approve(id),
      onSuccess: invalidate,
    }),
    order: useMutation({
      mutationFn: () => inventoryApi.purchaseOrders.order(id),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (reason?: string) => inventoryApi.purchaseOrders.cancel(id, reason),
      onSuccess: invalidate,
    }),
    receive: useMutation({
      mutationFn: (body: Parameters<typeof inventoryApi.purchaseOrders.receive>[1]) =>
        inventoryApi.purchaseOrders.receive(id, body),
      onSuccess: invalidate,
    }),
  };
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.purchaseOrders.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.purchaseOrders.all }),
  });
}

// ============================================================== TRANSFERS

export function useTransfers(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.transfers.list(params),
    queryFn: () => inventoryApi.transfers.list(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.inventory.transfers.detail(id) : ['inventory', 'transfers', 'noop'],
    queryFn: () => inventoryApi.transfers.get(id!),
    enabled: !!id,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.transfers.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.transfers.all }),
  });
}

export function useTransferActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.inventory.transfers.all }),
      qc.invalidateQueries({ queryKey: queryKeys.inventory.transfers.detail(id) }),
      qc.invalidateQueries({ queryKey: queryKeys.inventory.items.all }),
    ]);
  return {
    approve: useMutation({
      mutationFn: () => inventoryApi.transfers.approve(id),
      onSuccess: invalidate,
    }),
    dispatch: useMutation({
      mutationFn: () => inventoryApi.transfers.dispatch(id),
      onSuccess: invalidate,
    }),
    receive: useMutation({
      mutationFn: (body: Parameters<typeof inventoryApi.transfers.receive>[1]) =>
        inventoryApi.transfers.receive(id, body),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (reason?: string) => inventoryApi.transfers.cancel(id, reason),
      onSuccess: invalidate,
    }),
  };
}

// ============================================================== ALERTS

export function useInventoryAlerts(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.alerts.list(params),
    queryFn: () => inventoryApi.alerts.list(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useAlertActions() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['inventory', 'alerts'] });
  return {
    acknowledge: useMutation({
      mutationFn: inventoryApi.alerts.acknowledge,
      onSuccess: invalidate,
    }),
    resolve: useMutation({
      mutationFn: inventoryApi.alerts.resolve,
      onSuccess: invalidate,
    }),
    scan: useMutation({
      mutationFn: inventoryApi.alerts.scan,
      onSuccess: invalidate,
    }),
  };
}

// ============================================================== ANALYTICS

export function useInventoryValuation() {
  return useQuery({
    queryKey: queryKeys.inventory.analytics.valuation,
    queryFn: inventoryApi.analytics.valuation,
    staleTime: 60_000,
  });
}

export function useFastMoving(params: { days?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.analytics.fastMoving(params),
    queryFn: () => inventoryApi.analytics.fastMoving(params),
    staleTime: 60_000,
  });
}

export function useDeadStock(params: { days?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.analytics.deadStock(params),
    queryFn: () => inventoryApi.analytics.deadStock(params),
    staleTime: 60_000,
  });
}

export function useTurnover(params: { days?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.analytics.turnover(params),
    queryFn: () => inventoryApi.analytics.turnover(params),
    staleTime: 60_000,
  });
}

export function useProcurementSpend(params: { days?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.analytics.procurement(params),
    queryFn: () => inventoryApi.analytics.procurementSpend(params),
    staleTime: 60_000,
  });
}
