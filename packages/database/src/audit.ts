import { type Prisma, type PrismaClient } from '@prisma/client';

/**
 * Models whose mutations should be persisted to `audit_logs`.
 */
const AUDITED_MODELS = new Set<Prisma.ModelName>([
  'User',
  'Customer',
  'Technician',
  'Booking',
  'Invoice',
  'Payment',
  'Role',
  'Permission',
  'RolePermission',
  'UserRoleAssignment',
  'Lead',
  'LeadNote',
  'BookingNote',
  'BookingAttachment',
  'DispatchAssignment',
  'TechnicianShift',
  'Invoice',
  'InvoiceLineItem',
  'Quotation',
  'QuotationLineItem',
  'Payment',
  'PaymentTransaction',
  'Refund',
  'CreditNote',
  'CustomerLedgerEntry',
  'AMCPlan',
  'AMCSubscription',
  'AMCVisit',
  'TechnicianCommissionRule',
  'TechnicianCommission',
  'TechnicianPayout',
]);

type Actor = { userId?: string | null; tenantId?: string | null } | null;

/**
 * Wraps a PrismaClient to write an `AuditLog` row for create/update/delete
 * mutations on audited models. The actor is resolved per-call via a getter
 * so requests can attach their own context (e.g. via AsyncLocalStorage in
 * NestJS).
 */
export function withAudit<T extends PrismaClient>(client: T, getActor: () => Actor) {
  return client.$extends({
    name: 'audit',
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          await safeWriteAudit(client, getActor(), {
            action: 'CREATE',
            model,
            resourceId: (result as { id?: string })?.id,
            after: result,
          });
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          await safeWriteAudit(client, getActor(), {
            action: 'UPDATE',
            model,
            resourceId: (result as { id?: string })?.id,
            after: result,
          });
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          await safeWriteAudit(client, getActor(), {
            action: 'DELETE',
            model,
            resourceId: (result as { id?: string })?.id,
            before: result,
          });
          return result;
        },
      },
    },
  });
}

interface AuditPayload {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  model: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
}

async function safeWriteAudit(client: PrismaClient, actor: Actor, payload: AuditPayload) {
  if (!AUDITED_MODELS.has(payload.model as Prisma.ModelName)) return;
  try {
    await client.auditLog.create({
      data: {
        tenantId: actor?.tenantId ?? 'system',
        actorUserId: actor?.userId ?? null,
        action: payload.action,
        resourceType: payload.model,
        resourceId: payload.resourceId ?? null,
        before: (payload.before as Prisma.InputJsonValue | undefined) ?? undefined,
        after: (payload.after as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (err) {
    // Audit failures must never break a request. Log and move on.
    console.error('[audit] Failed to persist audit log', err);
  }
}
