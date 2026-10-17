/**
 * Pure duplicate-scoring helpers for customer de-duplication.
 */

export type DuplicateReason = 'phone' | 'email' | 'name_pincode' | 'name';

export interface DuplicateProbe {
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  pincodes?: string[];
}

export interface DuplicateCandidate {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  pincodes: string[];
}

export interface DuplicateMatch {
  id: string;
  reasons: DuplicateReason[];
  score: number;
}

/** Lower-case, strip diacritics/punctuation, collapse whitespace, drop honorifics. */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join(' ');
}

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'sri']);

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Jaccard similarity of character trigrams over sorted tokens (0..1). */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeName(a).split(' ').sort().join(' ');
  const nb = normalizeName(b).split(' ').sort().join(' ');
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = trigrams(na);
  const tb = trigrams(nb);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export const FUZZY_NAME_THRESHOLD = 0.6;

/** Score one candidate against the probe; returns null when nothing matches. */
export function scoreDuplicate(
  probe: DuplicateProbe,
  candidate: DuplicateCandidate,
): DuplicateMatch | null {
  const reasons: DuplicateReason[] = [];
  let score = 0;

  if (probe.phone && candidate.phone && digitsTail(probe.phone) === digitsTail(candidate.phone)) {
    reasons.push('phone');
    score += 60;
  }
  if (
    probe.email &&
    probe.email.trim().toLowerCase() === candidate.email?.trim().toLowerCase()
  ) {
    reasons.push('email');
    score += 40;
  }

  const sim = probe.fullName ? nameSimilarity(probe.fullName, candidate.fullName) : 0;
  const sharedPincode =
    (probe.pincodes ?? []).length > 0 &&
    candidate.pincodes.some((p) => (probe.pincodes ?? []).includes(p));

  if (sharedPincode && sim >= FUZZY_NAME_THRESHOLD) {
    reasons.push('name_pincode');
    score += Math.round(30 * sim);
  } else if (sim >= 0.85) {
    reasons.push('name');
    score += Math.round(15 * sim);
  }

  if (!reasons.length) return null;
  return { id: candidate.id, reasons, score: Math.min(100, score) };
}

/** Last 10 digits — tolerant to +91 / 0 / 91 prefix differences. */
function digitsTail(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function rankDuplicates(
  probe: DuplicateProbe,
  candidates: DuplicateCandidate[],
  excludeId?: string,
): DuplicateMatch[] {
  return candidates
    .filter((c) => c.id !== excludeId)
    .map((c) => scoreDuplicate(probe, c))
    .filter((m): m is DuplicateMatch => m !== null)
    .sort((a, b) => b.score - a.score);
}
