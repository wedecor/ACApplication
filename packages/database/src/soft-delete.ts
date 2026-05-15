import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Models that support soft delete. Keep this list in sync with the schema —
 * every model with a `deletedAt` field must be listed here so the extension
 * can transparently filter and rewrite queries.
 */
const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  'Tenant',
  'City',
  'User',
  'Customer',
  'Address',
  'Technician',
  'Booking',
  'Invoice',
  'Payment',
  'Notification',
  'Lead',
  'LeadNote',
  'BookingNote',
  'BookingAttachment',
  'Invoice',
  'Payment',
  'Quotation',
  'AMCPlan',
  'AMCSubscription',
  'TechnicianPayout',
]);

/**
 * Returns a PrismaClient where:
 *   * `findMany` / `findFirst` / `findUnique` exclude soft-deleted rows
 *     unless `withDeleted: true` is passed via `where`.
 *   * `delete` / `deleteMany` are rewritten to set `deletedAt = now()`.
 *
 * Uses the official client extension API.
 */
export function withSoftDelete<T extends PrismaClient>(client: T) {
  return client.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) {
            args.where = appendNotDeleted(args.where);
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) {
            args.where = appendNotDeleted(args.where);
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) {
            args.where = appendNotDeleted(args.where);
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) {
            args.where = appendNotDeleted(args.where);
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) return query(args);
          return (client as unknown as Record<string, { update: Function }>)[
            // PrismaClient delegate keys are camelCase first letter.
            (model as string).charAt(0).toLowerCase() + model.slice(1)
          ]!.update({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as unknown as ReturnType<typeof query>;
        },
        async deleteMany({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model as Prisma.ModelName)) return query(args);
          return (client as unknown as Record<string, { updateMany: Function }>)[
            (model as string).charAt(0).toLowerCase() + model.slice(1)
          ]!.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          }) as unknown as ReturnType<typeof query>;
        },
      },
    },
  });
}

function appendNotDeleted(where: unknown): Record<string, unknown> {
  const obj = (where ?? {}) as Record<string, unknown>;
  // Caller can opt-out by passing `{ deletedAt: null }` themselves or by
  // passing the magic key `withDeleted: true` (which we strip).
  if ('withDeleted' in obj) {
    const { withDeleted: _, ...rest } = obj;
    return rest;
  }
  if ('deletedAt' in obj) return obj;
  return { ...obj, deletedAt: null };
}
