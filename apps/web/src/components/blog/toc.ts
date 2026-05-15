/**
 * Extracts the H2 / H3 headings from a raw MDX body so we can render a
 * sidebar table-of-contents that links into the article (via
 * `rehype-slug` anchors).
 *
 * Naïve regex-based — fine for the constraints of our blog: markdown
 * headings are stable, MDX-component-headings are rare. If we start
 * accepting H2/H3 inside MDX components we'd need an AST walk.
 */
export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractToc(mdx: string): TocEntry[] {
  const lines = mdx.split('\n');
  const out: TocEntry[] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1]!.length as 2 | 3;
    const text = match[2]!.replace(/[*_`]/g, '').trim();
    const id = slugify(text);
    out.push({ id, text, level });
  }
  return out;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
