'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Plus, ExternalLink, Eye, ThumbsUp } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { useKbActions, useKbArticles, useKbCategories } from '@/hooks/use-support';
import type { KbArticle } from '@/lib/api/support';
import { formatDateTime } from '@/lib/format';

const STATUS_VARIANT: Record<
  KbArticle['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  PUBLISHED: 'default',
  ARCHIVED: 'secondary',
};

export default function KnowledgeBasePage() {
  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const categories = useKbCategories();
  const articles = useKbArticles({
    page,
    pageSize: 20,
    search: search || undefined,
    categoryId,
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BookOpen className="size-5" />
            Knowledge base
          </h1>
          <p className="text-sm text-muted-foreground">
            FAQs and self-service articles published on the customer help center.
          </p>
        </div>
        <Button onClick={() => setCreating((p) => !p)}>
          <Plus className="size-4" />
          {creating ? 'Cancel' : 'New article'}
        </Button>
      </header>

      {creating ? <NewArticleForm onDone={() => setCreating(false)} /> : null}

      {articles.error ? (
        <LoadError label="articles" message={(articles.error as Error).message} />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Button
            size="sm"
            variant={!categoryId ? 'default' : 'outline'}
            onClick={() => setCategoryId(undefined)}
          >
            All categories
          </Button>
          {categories.data?.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={categoryId === c.id ? 'default' : 'outline'}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        {articles.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (articles.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No articles" description="Write your first KB article." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Helpful</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-28">Public</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(articles.data?.items ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/knowledge-base/${a.id}`} className="hover:underline">
                        <div className="font-medium">{a.title}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {a.excerpt ?? a.bodyMarkdown.slice(0, 120)}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>{a.category?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3" />
                        {a.viewCount}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="size-3" />
                        {a.helpfulCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(a.updatedAt)}
                    </TableCell>
                    <TableCell>
                      {a.visibility === 'PUBLIC' && a.status === 'PUBLISHED' ? (
                        <a
                          href={`/help/${a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">private</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {articles.data ? (
          <Pagination
            page={articles.data.meta.page}
            pageSize={articles.data.meta.pageSize}
            total={articles.data.meta.total}
            totalPages={articles.data.meta.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>
    </div>
  );
}

function NewArticleForm({ onDone }: { onDone: () => void }) {
  const kb = useKbActions();
  const categories = useKbCategories();
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [excerpt, setExcerpt] = React.useState('');
  const [bodyMarkdown, setBody] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [visibility, setVisibility] =
    React.useState<KbArticle['visibility']>('PUBLIC');

  const submit = () => {
    if (!title.trim() || !slug.trim()) return;
    kb.createArticle.mutate(
      {
        title,
        slug,
        excerpt: excerpt || undefined,
        bodyMarkdown,
        categoryId: categoryId || undefined,
        visibility,
        status: 'DRAFT',
      },
      {
        onSuccess: () => {
          setTitle('');
          setSlug('');
          setExcerpt('');
          setBody('');
          onDone();
        },
      },
    );
  };

  return (
    <div className="rounded-md border bg-card p-4">
      <h2 className="text-sm font-semibold">New article</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="slug-like-this" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">No category</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as KbArticle['visibility'])}
        >
          <option value="PUBLIC">Public</option>
          <option value="CUSTOMER_AUTHENTICATED">Authenticated customers</option>
          <option value="INTERNAL">Internal only</option>
        </select>
      </div>
      <Input
        className="mt-3"
        placeholder="Excerpt (optional)"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />
      <textarea
        className="mt-3 min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="# Markdown body…"
        value={bodyMarkdown}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={kb.createArticle.isPending}>
          Save draft
        </Button>
      </div>
    </div>
  );
}
