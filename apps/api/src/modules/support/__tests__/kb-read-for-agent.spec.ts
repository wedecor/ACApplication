import { NotFoundException } from '@nestjs/common';

import { KnowledgeBaseService } from '../knowledge-base.service';

describe('KnowledgeBaseService.readForAgent', () => {
  const actor = { tenantId: 't1', userId: 'u1' } as never;

  function build(row: unknown) {
    const findFirst = jest.fn().mockResolvedValue(row);
    const prisma = { client: { knowledgeBaseArticle: { findFirst } } };
    const svc = new (KnowledgeBaseService as unknown as new (...a: unknown[]) => KnowledgeBaseService)(prisma);
    return { svc, findFirst };
  }

  it('returns the full article with category and author for the editor', async () => {
    const row = { id: 'a1', title: 'AC not cooling?', slug: 'ac', bodyMarkdown: '# Hi', viewCount: 3 };
    const { svc, findFirst } = build(row);
    await expect(svc.readForAgent(actor, 'a1')).resolves.toBe(row);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1', tenantId: 't1', deletedAt: null },
        include: expect.objectContaining({ category: expect.anything(), author: expect.anything() }),
      }),
    );
  });

  it('404s for missing or other-tenant articles', async () => {
    const { svc } = build(null);
    await expect(svc.readForAgent(actor, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
