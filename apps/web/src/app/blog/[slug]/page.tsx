import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { Badge } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { ReadingProgressBar } from '@/components/blog/reading-progress';
import { extractToc } from '@/components/blog/toc';
import { JsonLd } from '@/components/seo/json-ld';
import { getAllPostSlugs, getPostBySlug, getRelatedPosts } from '@/content/blog';
import { siteConfig } from '@/env';
import { articleJsonLd, faqJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/blog-format';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    image: post.cover,
    type: 'article',
    canonical: post.canonical,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: [post.author],
    tags: post.tags,
    keywords: post.tags,
  });
}

export const revalidate = 3600;

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return notFound();
  const toc = extractToc(post.content);
  const related = await getRelatedPosts(post.slug, 3);

  return (
    <>
      <ReadingProgressBar />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Blog', href: '/blog' },
          { name: post.title, href: `/blog/${post.slug}` },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-8">
          <Badge variant="muted">{post.category}</Badge>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{post.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            <span>·</span>
            <span>{post.readingMinutes} min read</span>
          </div>
        </header>

        {/* TOC — collapsible on mobile, sticky on desktop */}
        {toc.length > 3 ? (
          <aside className="mb-8 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              In this article
            </p>
            <ol className="flex flex-col gap-1">
              {toc.map((entry) => (
                <li key={entry.id} className={entry.level === 3 ? 'pl-3' : ''}>
                  <a
                    href={`#${entry.id}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}

        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-xl">
          <MDXRemote
            source={post.content}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                  rehypeSlug,
                  [
                    rehypeAutolinkHeadings,
                    { behavior: 'wrap', properties: { className: 'anchor' } },
                  ],
                ],
              },
            }}
          />
        </div>

        {post.faqs.length ? (
          <Faq items={post.faqs} includeJsonLd={false} title="Frequently asked" />
        ) : null}

        {related.length ? (
          <section className="mt-12 border-t border-border pt-10">
            <h2 className="text-xl font-semibold">Related reads</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}` as never}
                  className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>

      <CtaBand />

      <JsonLd
        data={[
          articleJsonLd({
            title: post.title,
            description: post.description,
            image: post.cover ?? siteConfig.ogImage,
            url: `/blog/${post.slug}`,
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
            author: post.author,
          }),
          ...(post.faqs.length ? [faqJsonLd(post.faqs)] : []),
        ]}
      />
    </>
  );
}
