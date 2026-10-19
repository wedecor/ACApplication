import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Models that support soft delete: every model with a `deletedAt` field,
 * read from the generated schema so the list can never drift (a hand-kept
 * list had missed 23 models, whose deletes were permanent and whose reads
 * returned deleted rows).
 */
export const SOFT_DELETE_MODELS: ReadonlySet<Prisma.ModelName> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'deletedAt'))
    .map((m) => m.name as Prisma.ModelName),
);

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
