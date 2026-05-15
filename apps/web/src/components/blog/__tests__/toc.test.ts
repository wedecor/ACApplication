import { describe, expect, it } from 'vitest';

import { extractToc } from '@/components/blog/toc';

describe('extractToc', () => {
  it('captures H2 and H3 with slugified ids', () => {
    const mdx = `
# Title

## First section
Body.

### Nested section
More body.

## Second section
End.
`;
    const toc = extractToc(mdx);
    expect(toc.map((t) => t.id)).toEqual(['first-section', 'nested-section', 'second-section']);
    expect(toc.map((t) => t.level)).toEqual([2, 3, 2]);
  });

  it('ignores headings inside fenced code blocks', () => {
    const mdx = `
## Real

\`\`\`
## Fake heading inside code
\`\`\`

## Also real
`;
    const toc = extractToc(mdx);
    expect(toc.map((t) => t.text)).toEqual(['Real', 'Also real']);
  });
});
