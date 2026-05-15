import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateKbArticleDto,
  CreateKbCategoryDto,
  KbFeedbackDto,
  ListKbArticlesDto,
  UpdateKbArticleDto,
  UpdateKbCategoryDto,
} from './dto/kb.dto';
import { KnowledgeBaseService } from './knowledge-base.service';

@ApiTags('support:kb')
@ApiBearerAuth()
@Controller({ path: 'support/kb', version: '1' })
export class KnowledgeBaseController {
  constructor(private readonly kb: KnowledgeBaseService) {}

  @Get('categories')
  @RequirePermissions(Permission.KB_VIEW)
  listCategories(@CurrentUser() actor: AuthPrincipal) {
    return this.kb.listCategories(actor);
  }

  @Post('categories')
  @RequirePermissions(Permission.KB_WRITE)
  createCategory(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateKbCategoryDto) {
    return this.kb.createCategory(actor, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions(Permission.KB_WRITE)
  updateCategory(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateKbCategoryDto,
  ) {
    return this.kb.updateCategory(actor, id, dto);
  }

  @Get('articles')
  @RequirePermissions(Permission.KB_VIEW)
  async listArticles(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListKbArticlesDto) {
    const r = await this.kb.listArticles(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Post('articles')
  @RequirePermissions(Permission.KB_WRITE)
  createArticle(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateKbArticleDto) {
    return this.kb.createArticle(actor, dto);
  }

  @Patch('articles/:id')
  @RequirePermissions(Permission.KB_WRITE)
  updateArticle(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateKbArticleDto,
  ) {
    return this.kb.updateArticle(actor, id, dto);
  }

  @Delete('articles/:id')
  @RequirePermissions(Permission.KB_PUBLISH)
  deleteArticle(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.kb.deleteArticle(actor, id);
  }

  @Get('articles/:id')
  @RequirePermissions(Permission.KB_VIEW)
  read(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.kb.readForAgent(actor, id);
  }
}

@ApiTags('public:kb')
@Controller({ path: 'public/kb', version: '1' })
export class PublicKnowledgeBaseController {
  constructor(private readonly kb: KnowledgeBaseService) {}

  @Public()
  @Get('articles/:tenantId/:slug')
  @ApiOperation({ summary: 'Read a public KB article by slug.' })
  read(@Param('tenantId') tenantId: string, @Param('slug') slug: string) {
    return this.kb.readPublic(tenantId, slug);
  }

  @Public()
  @Post('articles/:tenantId/:id/feedback')
  @ApiOperation({ summary: 'Record helpful / not-helpful feedback.' })
  feedback(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: KbFeedbackDto,
  ) {
    return this.kb.recordFeedback(tenantId, id, dto);
  }
}
