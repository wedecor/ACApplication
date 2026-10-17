/**
 * Pure job-card helpers: form <-> wire mapping, checklist answers, required
 * item validation, readings extraction, warranty summary.
 *
 * No React Native imports — unit-tested in `__tests__/jobcard-logic.test.ts`.
 */
import type {
  ChecklistEntry,
  ChecklistTemplate,
  ChecklistTemplateItem,
  JobCard,
  JobCardPatch,
  RecommendedPart,
  WarrantyStatus,
} from './repair-types';

export interface JobCardForm {
  symptoms: string[];
  symptomNotes: string;
  faultCodes: string[];
  diagnosis: string;
  rootCause: string;
  resolution: string;
  checklist: ChecklistEntry[];
  partsRecommended: RecommendedPart[];
  photos: string[];
  firstTimeFix: boolean | null;
  technicianRemarks: string;
}

/** Free-text symptom notes travel inside `symptoms` with this prefix. */
export const SYMPTOM_NOTE_PREFIX = 'Note: ';

export function emptyJobCardForm(): JobCardForm {
  return {
    symptoms: [],
    symptomNotes: '',
    faultCodes: [],
    diagnosis: '',
    rootCause: '',
    resolution: '',
    checklist: [],
    partsRecommended: [],
    photos: [],
    firstTimeFix: null,
    technicianRemarks: '',
  };
}

function asRecommendedPart(raw: unknown): RecommendedPart | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name : typeof r.sku === 'string' ? r.sku : null;
  if (!name) return null;
  const qty = typeof r.quantity === 'number' && r.quantity > 0 ? Math.floor(r.quantity) : 1;
  return {
    name,
    quantity: qty,
    ...(typeof r.itemId === 'string' ? { itemId: r.itemId } : {}),
    ...(typeof r.sku === 'string' ? { sku: r.sku } : {}),
    ...(typeof r.inVan === 'boolean' ? { inVan: r.inVan } : {}),
  };
}

export function formFromJobCard(jc: JobCard | null): JobCardForm {
  if (!jc) return emptyJobCardForm();
  const notes = jc.symptoms.filter((s) => s.startsWith(SYMPTOM_NOTE_PREFIX));
  return {
    symptoms: jc.symptoms.filter((s) => !s.startsWith(SYMPTOM_NOTE_PREFIX)),
    symptomNotes: notes.map((s) => s.slice(SYMPTOM_NOTE_PREFIX.length)).join('\n'),
    faultCodes: [...jc.faultCodes],
    diagnosis: jc.diagnosis ?? '',
    rootCause: jc.rootCause ?? '',
    resolution: jc.resolution ?? '',
    checklist: jc.checklist.map((c) => ({ ...c, answers: { ...c.answers } })),
    partsRecommended: jc.partsRecommended
      .map(asRecommendedPart)
      .filter((p): p is RecommendedPart => p != null),
    photos: [...jc.photos],
    firstTimeFix: jc.firstTimeFix,
    technicianRemarks: jc.technicianRemarks ?? '',
  };
}

/**
 * Readings are derived from every `number` checklist item — the server keeps
 * them in a flat `readings` map (e.g. `{ gasPressurePsi: 68 }`) for
 * reporting, while the checklist answers keep the per-template context.
 */
export function buildReadings(
  templates: readonly ChecklistTemplate[],
  checklist: readonly ChecklistEntry[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of templates) {
    const entry = checklist.find((c) => c.templateId === t.id);
    if (!entry) continue;
    for (const item of t.items) {
      if (item.type !== 'number') continue;
      const v = entry.answers[item.key];
      if (typeof v === 'number' && Number.isFinite(v)) out[item.key] = v;
    }
  }
  return out;
}

const nullIfBlank = (s: string): string | null => (s.trim() ? s.trim() : null);

export function formToPatch(form: JobCardForm, templates: readonly ChecklistTemplate[]): JobCardPatch {
  const noteLines = form.symptomNotes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `${SYMPTOM_NOTE_PREFIX}${l}`);
  return {
    symptoms: [...form.symptoms, ...noteLines],
    faultCodes: form.faultCodes,
    diagnosis: nullIfBlank(form.diagnosis),
    rootCause: nullIfBlank(form.rootCause),
    resolution: nullIfBlank(form.resolution),
    readings: buildReadings(templates, form.checklist),
    checklist: form.checklist,
    partsRecommended: form.partsRecommended,
    photos: form.photos,
    firstTimeFix: form.firstTimeFix,
    technicianRemarks: nullIfBlank(form.technicianRemarks),
  };
}

export function getAnswer(
  checklist: readonly ChecklistEntry[],
  templateId: string,
  key: string,
): unknown {
  return checklist.find((c) => c.templateId === templateId)?.answers[key];
}

/** Immutable update; `undefined` clears the answer. */
export function setAnswer(
  checklist: readonly ChecklistEntry[],
  template: Pick<ChecklistTemplate, 'id' | 'kind'>,
  key: string,
  value: unknown,
): ChecklistEntry[] {
  const idx = checklist.findIndex((c) => c.templateId === template.id);
  const prev: ChecklistEntry =
    idx >= 0
      ? (checklist[idx]!)
      : { templateId: template.id, kind: template.kind, answers: {} };
  const answers = { ...prev.answers };
  if (value === undefined) delete answers[key];
  else answers[key] = value;
  const next: ChecklistEntry = { ...prev, answers };
  return idx >= 0 ? checklist.map((c, i) => (i === idx ? next : c)) : [...checklist, next];
}

export function isAnswered(item: Pick<ChecklistTemplateItem, 'type'>, value: unknown): boolean {
  switch (item.type) {
    case 'bool':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'text':
    case 'photo':
      return typeof value === 'string' && value.trim().length > 0;
    default:
      return false;
  }
}

export interface MissingItem {
  templateId: string;
  templateName: string;
  kind: ChecklistTemplate['kind'];
  key: string;
  label: string;
}

export function findMissingRequired(
  templates: readonly ChecklistTemplate[],
  checklist: readonly ChecklistEntry[],
): MissingItem[] {
  const missing: MissingItem[] = [];
  for (const t of templates) {
    for (const item of t.items) {
      if (!item.required) continue;
      if (!isAnswered(item, getAnswer(checklist, t.id, item.key))) {
        missing.push({
          templateId: t.id,
          templateName: t.name,
          kind: t.kind,
          key: item.key,
          label: item.label,
        });
      }
    }
  }
  return missing;
}

export function checklistProgress(
  template: ChecklistTemplate,
  checklist: readonly ChecklistEntry[],
): { answered: number; total: number; requiredMissing: number } {
  let answered = 0;
  let requiredMissing = 0;
  for (const item of template.items) {
    const ok = isAnswered(item, getAnswer(checklist, template.id, item.key));
    if (ok) answered += 1;
    else if (item.required) requiredMissing += 1;
  }
  return { answered, total: template.items.length, requiredMissing };
}

/**
 * Lenient numeric parse for readings typed on a phone keypad.
 *   ''      → undefined (clear)
 *   '68.5'  → 68.5,  '68,5' → 68.5
 *   'abc'   → null (invalid; keep the text but don't save)
 */
export function parseReading(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Common symptoms per service category; free text covers the long tail. */
const SYMPTOMS: Record<string, string[]> = {
  AC: [
    'Not cooling',
    'Low cooling',
    'Water leakage',
    'Noise / vibration',
    'Bad smell',
    'Ice on coil',
    'Not turning on',
    'Remote not working',
    'Tripping / MCB',
    'Error code on display',
  ],
  REFRIGERATOR: [
    'Not cooling',
    'Over cooling / freezing',
    'Water leakage',
    'Noise',
    'Door seal damaged',
    'Not turning on',
    'Ice build-up',
  ],
  WASHING_MACHINE: [
    'Not spinning',
    'Not draining',
    'Water leakage',
    'Noise / vibration',
    'Door not locking',
    'Not turning on',
    'Error code on display',
  ],
};
const GENERIC_SYMPTOMS = ['Not turning on', 'Noise', 'Leakage', 'Error code on display', 'Physical damage'];

export function symptomOptions(category: string | null | undefined): string[] {
  if (!category) return GENERIC_SYMPTOMS;
  const key = category.toUpperCase();
  const direct = SYMPTOMS[key];
  if (direct) return direct;
  const fuzzy = Object.keys(SYMPTOMS).find((k) => key.includes(k) || k.includes(key));
  return fuzzy ? (SYMPTOMS[fuzzy] ?? GENERIC_SYMPTOMS) : GENERIC_SYMPTOMS;
}

export interface WarrantySummary {
  covered: boolean;
  /** Short headline for the badge. */
  headline: string;
  lines: string[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

export function summarizeWarranty(w: WarrantyStatus | null | undefined): WarrantySummary {
  if (!w) return { covered: false, headline: 'Warranty unknown', lines: [] };
  const lines: string[] = [];
  if (w.manufacturer.until) {
    lines.push(`Manufacturer: ${w.manufacturer.active ? 'active' : 'expired'} (until ${fmtDate(w.manufacturer.until)})`);
  }
  if (w.extended.until) {
    lines.push(`Extended: ${w.extended.active ? 'active' : 'expired'} (until ${fmtDate(w.extended.until)})`);
  }
  if (w.repair.until) {
    lines.push(`Repair warranty: ${w.repair.active ? 'active' : 'expired'} (until ${fmtDate(w.repair.until)})`);
  }
  if (w.amcCovered) lines.push('Covered by an active AMC');
  const headline = w.repair.active
    ? 'Under repair warranty'
    : w.manufacturer.active
      ? 'Under manufacturer warranty'
      : w.extended.active
        ? 'Under extended warranty'
        : w.amcCovered
          ? 'AMC covered'
          : 'Out of warranty';
  const covered = w.repair.active || w.manufacturer.active || w.extended.active || w.amcCovered;
  return { covered, headline, lines };
}

/** Coalesce two partial job-card writes (later wins, field by field). */
export function mergeJobCardPatch(a: JobCardPatch, b: JobCardPatch): JobCardPatch {
  return { ...a, ...b };
}

/**
 * Missing items from a 400 CHECKLIST_INCOMPLETE response
 * (`error.details.missing`). Ignores malformed entries.
 */
export function parseMissingItems(details: unknown): MissingItem[] {
  const raw = (details as { missing?: unknown } | null)?.missing;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m): MissingItem[] => {
    if (!m || typeof m !== 'object') return [];
    const r = m as Record<string, unknown>;
    if (typeof r.key !== 'string') return [];
    return [
      {
        templateId: typeof r.templateId === 'string' ? r.templateId : '',
        templateName: typeof r.templateName === 'string' ? r.templateName : 'Checklist',
        kind: (typeof r.kind === 'string' ? r.kind : 'PRE_SERVICE') as ChecklistTemplate['kind'],
        key: r.key,
        label: typeof r.label === 'string' ? r.label : r.key,
      },
    ];
  });
}

export function formatMissingItems(missing: readonly MissingItem[], max = 8): string {
  const lines = missing.slice(0, max).map((m) => `• ${m.templateName}: ${m.label}`);
  if (missing.length > max) lines.push(`…and ${missing.length - max} more`);
  return lines.join('\n');
}
