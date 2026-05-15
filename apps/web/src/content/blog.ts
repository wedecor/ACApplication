/**
 * MDX blog loader.
 *
 * Posts are authored as `.mdx` files under `apps/web/src/content/blog/`.
 * Each post has YAML frontmatter (title, description, publishedAt, tags…)
 * and free-form MDX body.
 *
 * Loading happens at build time:
 *   • `getAllPosts()` reads the directory once + caches the result.
 *   • Individual pages re-use the cache via `getPostBySlug()`.
 *
 * The loader returns *raw source* — the actual MDX compilation happens
 * inside the page component using `<MDXRemote>` (next-mdx-remote/rsc).
 * This keeps the loader pure / non-React so it can be used from
 * server actions, sitemap generators and tests.
 */

import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import readingTime from 'reading-time';
import { z } from 'zod';

const BLOG_DIR = path.join(process.cwd(), 'src', 'content', 'blog');

const FrontmatterSchema = z.object({
  title: z.string().min(4),
  description: z.string().min(20).max(220),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  author: z.string().default('AC Platform Editorial'),
  /** Hero / OG image — relative to /public. */
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z
    .enum(['guide', 'maintenance', 'comparison', 'troubleshooting', 'announcement', 'tips'])
    .default('guide'),
  /** Optional related-post slugs. */
  related: z.array(z.string()).default([]),
  /** Optional FAQs — feeds FAQPage JSON-LD. */
  faqs: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
  /** Optional canonical override (when republishing). */
  canonical: z.string().url().optional(),
  draft: z.boolean().default(false),
});

export type BlogFrontmatter = z.infer<typeof FrontmatterSchema>;

export interface BlogPost extends BlogFrontmatter {
  slug: string;
  /** MDX source (compiled per-page). */
  content: string;
  /** Estimated reading time in minutes. */
  readingMinutes: number;
}

let cachedPosts: BlogPost[] | null = null;

/** Read every post once and cache. Re-evaluated when the dev server restarts. */
export async function getAllPosts(includeDrafts = false): Promise<BlogPost[]> {
  if (cachedPosts) return includeDrafts ? cachedPosts : cachedPosts.filter((p) => !p.draft);
  let files: string[] = [];
  try {
    files = await fs.readdir(BLOG_DIR);
  } catch {
    // Blog directory may be empty on a fresh checkout.
    cachedPosts = [];
    return [];
  }
  const posts: BlogPost[] = [];
  for (const file of files) {
    if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
    const slug = file.replace(/\.mdx?$/, '');
    const raw = await fs.readFile(path.join(BLOG_DIR, file), 'utf8');
    const parsed = matter(raw);
    const fm = FrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) {
      // Surface the error so authors notice immediately during dev.
      console.warn(`[blog] Skipping ${file} — frontmatter invalid:`, fm.error.flatten());
      continue;
    }
    posts.push({
      ...fm.data,
      slug,
      content: parsed.content,
      readingMinutes: Math.max(1, Math.round(readingTime(parsed.content).minutes)),
    });
  }
  posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  cachedPosts = posts;
  return includeDrafts ? posts : posts.filter((p) => !p.draft);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const all = await getAllPosts(true);
  return all.find((p) => p.slug === slug && !p.draft) ?? null;
}

export async function getRelatedPosts(slug: string, limit = 3): Promise<BlogPost[]> {
  const post = await getPostBySlug(slug);
  if (!post) return [];
  const all = await getAllPosts();
  const scored = all
    .filter((p) => p.slug !== slug)
    .map((p) => {
      const explicit = post.related.includes(p.slug) ? 100 : 0;
      const tagOverlap = p.tags.filter((t) => post.tags.includes(t)).length;
      return { post: p, score: explicit + tagOverlap };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.post);
}

export async function getAllPostSlugs(): Promise<string[]> {
  const all = await getAllPosts();
  return all.map((p) => p.slug);
}
