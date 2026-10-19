import { SOFT_DELETE_MODELS } from '@ac/database';
import { Prisma } from '@prisma/client';

describe('soft-delete model coverage', () => {
  it('covers exactly the models that have a deletedAt column', () => {
    const expected = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === 'deletedAt'))
      .map((m) => m.name)
      .sort();
    expect([...SOFT_DELETE_MODELS].sort()).toEqual(expected);
    // Spot-check models the old hand-kept list had missed.
    for (const m of ['SupportTicket', 'Conversation', 'InventoryItem', 'PurchaseOrder', 'KnowledgeBaseArticle']) {
      expect(SOFT_DELETE_MODELS.has(m as Prisma.ModelName)).toBe(true);
    }
  });
});
