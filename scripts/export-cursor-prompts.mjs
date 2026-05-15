#!/usr/bin/env node
/**
 * Export user prompts from Cursor agent transcripts into docs/cursor-prompts/.
 * Source: ~/.cursor/projects/<workspace>/agent-transcripts/
 */
import { createReadStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(PROJECT_ROOT, 'docs', 'cursor-prompts');
const TRANSCRIPT_ROOT = join(
  homedir(),
  '.cursor',
  'projects',
  'home-nmc-40324-Desktop-AC-Project',
  'agent-transcripts',
);

function slugify(name) {
  return name.replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 80);
}

function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n\n');
}

async function parseJsonl(filePath) {
  const prompts = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.role !== 'user') continue;
      const text = extractText(row.message?.content);
      if (!text.trim()) continue;
      prompts.push(text.trim());
    } catch {
      /* skip malformed lines */
    }
  }
  return prompts;
}

function firstLineTitle(text) {
  const match = text.match(/<user_query>\s*([\s\S]*?)(?:<\/user_query>|$)/);
  const body = match ? match[1].trim() : text;
  const line = body.split('\n').find((l) => l.trim().length > 10) ?? body;
  return line.replace(/^#+\s*/, '').slice(0, 120);
}

async function exportSession(sessionDir, sessionId) {
  const jsonl = join(sessionDir, `${sessionId}.jsonl`);
  const prompts = await parseJsonl(jsonl);
  if (prompts.length === 0) return null;

  const title = firstLineTitle(prompts[0]);
  const md = [
    `# Cursor session: ${sessionId}`,
    '',
    `> Exported from agent transcript. ${prompts.length} user message(s).`,
    '',
    ...prompts.flatMap((p, i) => [
      `---`,
      '',
      `## Prompt ${i + 1}`,
      '',
      p,
      '',
    ]),
  ].join('\n');

  const outName = `${slugify(title) || 'session'}-${sessionId.slice(0, 8)}.md`;
  const outPath = join(OUT_DIR, outName);
  writeFileSync(outPath, md, 'utf8');
  return { sessionId, outName, count: prompts.length, title };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const sessions = readdirSync(TRANSCRIPT_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const manifest = [];
  for (const sessionId of sessions) {
    const dir = join(TRANSCRIPT_ROOT, sessionId);
    const jsonlPath = join(dir, `${sessionId}.jsonl`);
    try {
      readFileSync(jsonlPath);
    } catch {
      continue;
    }
    const meta = await exportSession(dir, sessionId);
    if (meta) manifest.push(meta);
  }

  const readme = [
    '# Cursor prompts (AC Project)',
    '',
    'User prompts exported from Cursor Agent transcripts for this workspace.',
    'Re-export after new sessions:',
    '',
    '```bash',
    'node scripts/export-cursor-prompts.mjs',
    '```',
    '',
    'Source (local, not in repo): `~/.cursor/projects/home-nmc-40324-Desktop-AC-Project/agent-transcripts/`',
    '',
    '## Sessions',
    '',
    ...manifest.map(
      (m) => `- [${m.title}](./${m.outName}) — \`${m.sessionId}\` (${m.count} prompts)`,
    ),
    '',
  ].join('\n');

  writeFileSync(join(OUT_DIR, 'README.md'), readme, 'utf8');
  console.log(`Exported ${manifest.length} session(s) to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
