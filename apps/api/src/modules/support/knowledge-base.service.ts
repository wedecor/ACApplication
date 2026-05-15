import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { KbArticleStatus, KbVisibility } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateKbArticleDto,
  CreateKbCategoryDto,
  KbFeedbackDto,
  ListKbArticlesDto,
  UpdateKbArticleDto,
  UpdateKbCategoryDto,
} from './dto/kb.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------- categories

  async createCategory(
    actor: AuthPrincipal,
    dto: CreateKbCategoryDto,
  ): Promise<{ id: string }> {
    return this.prisma.client.knowledgeBaseCategory.create({
      data: {
        tenantId: actor.tenantId,
        parentId: dto.parentId,
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        ordering: dto.ordering ?? 0,
        isPublic: dto.isPublic ?? true,
      },
      select: { id: true },
    });
  }

  async updateCategory(
    actor: AuthPrincipal,
    id: string,
    dto: UpdateKbCategoryDto,
  ): Promise<void> {
    await this.requireCategory(actor.tenantId, id);
    await this.prisma.client.knowledgeBaseCategory.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId,
        ordering: dto.ordering,
        isPublic: dto.isPublic,
      },
    });
  }

  async listCategories(actor: AuthPrincipal): Promise<unknown[]> {
    return this.prisma.client.knowledgeBaseCategory.findMany({
      where: { tenantId: actor.tenantId, deletedAt: null },
      orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
    });
  }

  // -------------------------------------------------------------- articles

  async createArticle(
    actor: AuthPrincipal,
    dto: CreateKbArticleDto,
  ): Promise<{ id: string }> {
    const status = dto.status ?? KbArticleStatus.DRAFT;
    return this.prisma.client.knowledgeBaseArticle.create({
      data: {
        tenantId: actor.tenantId,
        categoryId: dto.categoryId,
        slug: dto.slug,
        title: dto.title,
        bodyMarkdown: dto.bodyMarkdown,
        excerpt: dto.excerpt,
        status,
        visibility: dto.visibility ?? KbVisibility.PUBLIC,
        authorUserId: actor.userId,
        tags: dto.tags ?? [],
        publishedAt: status === KbArticleStatus.PUBLISHED ? new Date() : null,
      },
      select: { id: true },
    });
  }

  async updateArticle(
    actor: AuthPrincipal,
    id: string,
    dto: UpdateKbArticleDto,
  ): Promise<void> {
    const article = await this.requireArticle(actor.tenantId, id);
    const data: Prisma.KnowledgeBaseArticleUpdateInput = {
      title: dto.title,
      slug: dto.slug,
      bodyMarkdown: dto.bodyMarkdown,
      excerpt: dto.excerpt,
      ...(dto.categoryId !== undefined
        ? dto.categoryId
          ? { category: { connect: { id: dto.categoryId } } }
          : { category: { disconnect: true } }
        : {}),
      visibility: dto.visibility,
      tags: dto.tags,
    };
    if (dto.status && dto.status !== article.status) {
      data.status = dto.status;
      if (dto.status === KbArticleStatus.PUBLISHED && !article.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    await this.prisma.client.knowledgeBaseArticle.update({ where: { id }, data });
  }

  async deleteArticle(actor: AuthPrincipal, id: string): Promise<void> {
    await this.requireArticle(actor.tenantId, id);
    await this.prisma.client.knowledgeBaseArticle.update({
      where: { id },
      data: { deletedAt: new Date(), status: KbArticleStatus.ARCHIVED },
    });
  }

  async listArticles(
    actor: AuthPrincipal,
    dto: ListKbArticlesDto,
  ): Promise<{ items: unknown[]; page: number; pageSize: number; total: number }> {
    const where: Prisma.KnowledgeBaseArticleWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.categoryId) where.categoryId = dto.categoryId;
    if (dto.status?.length) where.status = { in: dto.status };
    if (dto.visibility?.length) where.visibility = { in: dto.visibility };
    if (dto.tag) where.tags = { has: dto.tag };
    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { excerpt: { contains: dto.search, mode: 'insensitive' } },
        { bodyMarkdown: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.knowledgeBaseArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.client.knowledgeBaseArticle.count({ where }),
    ]);
    return { items, page: dto.page, pageSize: dto.pageSize, total };
  }

  /**
   * Public reader — only published, public articles. Bumps viewCount.
   */
  async readPublic(tenantId: string, slug: string): Promise<unknown> {
    const article = await this.prisma.client.knowledgeBaseArticle.findFirst({
      where: {
        tenantId,
        slug,
        status: KbArticleStatus.PUBLISHED,
        visibility: KbVisibility.PUBLIC,
        deletedAt: null,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.client.knowledgeBaseArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });
    return article;
  }

  async readForAgent(actor: AuthPrincipal, id: string): Promise<unknown> {
    const article = await this.requireArticle(actor.tenantId, id);
    return article;
  }

  async recordFeedback(
    tenantId: string,
    id: string,
    dto: KbFeedbackDto,
  ): Promise<void> {
    const article = await this.prisma.client.knowledgeBaseArticle.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.client.knowledgeBaseArticle.update({
      where: { id },
      data: dto.helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
    });
  }

  // ----------------------------------------------------------- internals

  private async requireCategory(
    tenantId: string,
    id: string,
  ): Promise<{ id: string }> {
    const row = await this.prisma.client.knowledgeBaseCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  private async requireArticle(tenantId: string, id: string): Promise<{
    id: string;
    status: KbArticleStatus;
    publishedAt: Date | null;
    bodyMarkdown: string;
  }> {
    const article = await this.prisma.client.knowledgeBaseArticle.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, status: true, publishedAt: true, bodyMarkdown: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }
}
