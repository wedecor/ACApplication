/**
 * Minimal RFC 4180 CSV helpers (no external dependency).
 */

import { BadRequestException } from '@nestjs/common';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Serialise one cell. Values that a spreadsheet would interpret as a formula
 * are prefixed with `'` (CSV/formula-injection guard); cells containing a
 * delimiter, quote or newline are quoted with doubled inner quotes.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);

  if (FORMULA_PREFIX.test(s) && !isPlainNumber(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Signed numbers ("-12.5", E.164 "+9198…") are data, not formulas. */
function isPlainNumber(s: string): boolean {
  return /^[-+]?\d+(\.\d+)?$/.test(s);
}

export function toCsvRow(values: readonly unknown[]): string {
  return `${values.map(escapeCsvCell).join(',')}\r\n`;
}

/**
 * Parse CSV text into rows of cells. Handles quoted fields, escaped quotes,
 * embedded newlines, CRLF/LF line endings and a leading UTF-8 BOM. Fully
 * empty lines are dropped.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushRow = () => {
    row.push(cell);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    cell = '';
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === '') {
      inQuotes = true;
      i++;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
      i++;
    } else if (ch === '\r') {
      pushRow();
      i += text[i + 1] === '\n' ? 2 : 1;
    } else if (ch === '\n') {
      pushRow();
      i++;
    } else {
      cell += ch;
      i++;
    }
  }
  if (inQuotes) throw new CsvParseError('Unterminated quoted field');
  if (cell !== '' || row.length) pushRow();
  return rows;
}

export class CsvParseError extends BadRequestException {}

/** Normalise a header for alias matching: "Full Name" → "fullname". */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_\-]/g, '');
}

/**
 * Turn parsed rows into objects keyed by canonical field names using an
 * alias map (canonical → accepted header spellings). Unknown headers are kept
 * verbatim (trimmed) so `cf_<key>` custom-field columns survive.
 */
export function rowsToRecords(
  rows: string[][],
  aliases: Record<string, string[]>,
): { headers: string[]; records: Record<string, string>[] } {
  const [headerRow, ...body] = rows;
  if (!headerRow) return { headers: [], records: [] };
  const lookup = new Map<string, string>();
  for (const [canonical, names] of Object.entries(aliases)) {
    lookup.set(normalizeHeader(canonical), canonical);
    for (const n of names) lookup.set(normalizeHeader(n), canonical);
  }
  const headers = headerRow.map((h) => {
    const trimmed = h.trim();
    if (/^cf_/i.test(trimmed)) return `cf_${trimmed.slice(3)}`;
    return lookup.get(normalizeHeader(trimmed)) ?? trimmed;
  });
  const records = body.map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const v = (cells[idx] ?? '').trim();
      if (v !== '') rec[h] = v;
    });
    return rec;
  });
  return { headers, records };
}
