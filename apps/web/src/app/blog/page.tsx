import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CtaBand } from '@/components/sections/cta-band';
import { getAllPosts } from '@/content/blog';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/blog-format';

export const metadata: Metadata = buildMetadata({
  title: 'Appliance Care Blog — Maintenance Tips, Repair Guides & Comparisons',
  description:
    'Expert advice on home appliance maintenance, repair guides, error-code decoders and product comparisons — written by certified technicians.',
  path: '/blog',
  keywords: [
    'ac maintenance tips',
    'washing machine error codes',
    'refrigerator troubleshooting',
    'home appliance care guide',
  ],
});

export const revalidate = 3600;

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Blog', href: '/blog' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Appliance care, decoded.
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Maintenance tips, error-code references, repair-cost guides and honest comparisons — written
            by our certified technicians.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <span className="inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {post.category}
                </span>
                <h2 className="text-lg font-semibold">
                  <Link href={`/blog/${post.slug}` as never} className="hover:text-primary">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-3">{post.description}</p>
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  <span>{post.readingMinutes} min read</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <CtaBand />
    </>
  );
}
