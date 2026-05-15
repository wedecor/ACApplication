import { Permission } from '@ac/types';

/** Minimum permission(s) required to access a CRM route. */
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/': [],
  '/dispatch': [Permission.DISPATCH_VIEW],
  '/live-map': [Permission.TECHNICIAN_TRACK],
  '/leads': [Permission.LEAD_VIEW],
  '/bookings': [Permission.BOOKING_READ],
  '/customers': [Permission.CUSTOMER_READ],
  '/technicians': [Permission.TECHNICIAN_TRACK],
  '/finance': [Permission.FINANCE_VIEW],
  '/invoices': [Permission.INVOICE_VIEW],
  '/payments': [Permission.PAYMENT_VIEW],
  '/amc': [Permission.AMC_VIEW],
  '/payouts': [Permission.PAYOUT_VIEW],
  '/inventory': [Permission.INVENTORY_VIEW],
  '/warehouses': [Permission.WAREHOUSE_VIEW],
  '/vendors': [Permission.VENDOR_VIEW],
  '/purchase-orders': [Permission.PURCHASE_ORDER_VIEW],
  '/transfers': [Permission.STOCK_TRANSFER_VIEW],
  '/inventory-alerts': [Permission.INVENTORY_ALERT_VIEW],
  '/support': [Permission.TICKET_VIEW],
  '/inbox': [Permission.INBOX_VIEW],
  '/tickets': [Permission.TICKET_VIEW],
  '/call-center': [Permission.CALL_VIEW],
  '/csat': [Permission.SUPPORT_ANALYTICS_VIEW],
  '/knowledge-base': [Permission.KB_VIEW],
  '/sla': [Permission.SLA_VIEW],
  '/canned-responses': [Permission.CANNED_RESPONSE_VIEW],
  '/notifications': [Permission.NOTIFICATION_VIEW],
  '/automation': [Permission.WORKFLOW_VIEW],
  '/settings': [],
};

export function permissionsForPath(pathname: string): Permission[] {
  const exact = ROUTE_PERMISSIONS[pathname];
  if (exact) return exact;
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((p) => p !== '/' && pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? (ROUTE_PERMISSIONS[match] ?? []) : [];
}
