'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@ac/ui';

import { useKbActions, useKbArticle } from '@/hooks/use-support';
import { formatDateTime } from '@/lib/format';

export default function KbArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: article, isLoading, error } = useKbArticle(id);
  const kb = useKbActions();

  const [title, setTitle] = React.useState('');
  const [bodyMarkdown, setBody] = React.useState('');
  const [status, setStatus] = React.useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('DRAFT');

  React.useEffect(() => {
    if (!article) return;
    setTitle(article.title);
    setBody(article.bodyMarkdown);
    setStatus(article.status);
  }, [article]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="space-y-4">
        <Link href="/knowledge-base" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back
        </Link>
        <p className="text-sm text-destructive">
          {error ? (error as Error).message : 'Article not found'}
        </p>
      </div>
    );
  }

  function save() {
    kb.updateArticle.mutate(
      {
        id,
        body: { title, bodyMarkdown, status },
      },
      {
        onSuccess: () => toast.success('Article saved'),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function publish() {
    kb.updateArticle.mutate(
      { id, body: { title, bodyMarkdown, status: 'PUBLISHED' } },
      {
        onSuccess: () => {
          setStatus('PUBLISHED');
          toast.success('Published');
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/knowledge-base" className="text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="inline size-4" /> Back to knowledge base
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Edit article</h1>
          <p className="text-sm text-muted-foreground">
            {article.category?.name ?? 'Uncategorised'} · Updated {formatDateTime(article.updatedAt)}
          </p>
        </div>
        <Badge>{status}</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <p className="font-mono text-xs text-muted-foreground">/{article.slug}</p>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <textarea
            className="min-h-[280px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={bodyMarkdown}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {article.viewCount} views · {article.helpfulCount} helpful
          </p>
        </CardContent>
      </Card>

      <footer className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={kb.updateArticle.isPending}>
          Save
        </Button>
        {status !== 'PUBLISHED' ? (
          <Button variant="secondary" onClick={publish} disabled={kb.updateArticle.isPending}>
            Publish
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() =>
            kb.archive.mutate(id, {
              onSuccess: () => {
                toast.success('Archived');
                router.push('/knowledge-base');
              },
            })
          }
        >
          Archive
        </Button>
      </footer>
    </section>
  );
}
