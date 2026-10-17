/**
 * Prisma returns BigInt for BIGINT columns (e.g. Customer.lifetimeValueMinor),
 * which JSON.stringify cannot serialise — any endpoint returning such a row
 * would 500. Serialise as a number when it is exactly representable, else as
 * a decimal string so precision is never silently lost.
 */
export function bigintToJson(value: bigint): number | string {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}

export function installBigIntJson(): void {
  // BigInt.prototype has no toJSON in the lib typings; augmenting it is the
  // standard hook JSON.stringify (and therefore Fastify) calls.
  const proto = BigInt.prototype as unknown as { toJSON?: () => number | string };
  if (!proto.toJSON) {
    proto.toJSON = function toJSON(this: bigint) {
      return bigintToJson(this.valueOf());
    };
  }
}
