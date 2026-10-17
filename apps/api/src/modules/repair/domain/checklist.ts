/**
 * Checklist template + job-card checklist helpers. Pure functions.
 */

export const CHECKLIST_ITEM_TYPES = ['bool', 'number', 'text', 'photo'] as const;
export type ChecklistItemType = (typeof CHECKLIST_ITEM_TYPES)[number];

export const CHECKLIST_KINDS = ['PRE_SERVICE', 'POST_SERVICE', 'SAFETY'] as const;
export type ChecklistKindValue = (typeof CHECKLIST_KINDS)[number];

export interface ChecklistItem {
  key: string;
  label: string;
  type: ChecklistItemType;
  unit?: string;
  required: boolean;
}

export interface ChecklistTemplateLike {
  id: string;
  /** ChecklistKindValue; typed as string because it is read back from JSON. */
  kind: string;
  name?: string;
  items: unknown;
}

/** One filled checklist on a job card. */
export interface ChecklistEntry {
  templateId: string;
  /** ChecklistKindValue; typed as string because it is read back from JSON. */
  kind: string;
  answers: Record<string, unknown>;
}

export interface MissingChecklistItem {
  templateId: string;
  templateName: string | null;
  kind: string;
  key: string;
  label: string;
}

export function parseChecklistItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (i): i is ChecklistItem =>
      !!i && typeof i === 'object' && typeof (i as ChecklistItem).key === 'string',
  );
}

export function parseChecklistEntries(raw: unknown): ChecklistEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is ChecklistEntry =>
        !!e && typeof e === 'object' && typeof (e as ChecklistEntry).templateId === 'string',
    )
    .map((e) => ({
      templateId: e.templateId,
      kind: e.kind,
      answers: e.answers && typeof e.answers === 'object' ? { ...e.answers } : {},
    }));
}

/** Is a checklist answer present for an item of the given type? `false` is a valid bool answer. */
export function isAnswered(type: string, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  switch (type) {
    case 'bool':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' ? Number.isFinite(value) : value !== '' && Number.isFinite(Number(value));
    case 'photo':
      if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && v.length > 0);
      return typeof value === 'string' && value.length > 0;
    default:
      return typeof value === 'string' ? value.trim().length > 0 : true;
  }
}

/**
 * Merge incoming checklist entries into the existing ones. Entries are keyed
 * by templateId; answers are shallow-merged so a partial save never wipes
 * previously captured answers.
 */
export function mergeChecklistEntries(
  existing: unknown,
  incoming: ChecklistEntry[],
): ChecklistEntry[] {
  const current = parseChecklistEntries(existing);
  const byTemplate = new Map(current.map((e) => [e.templateId, e]));
  for (const entry of incoming) {
    const prev = byTemplate.get(entry.templateId);
    byTemplate.set(entry.templateId, {
      templateId: entry.templateId,
      kind: entry.kind ?? prev?.kind,
      answers: { ...(prev?.answers ?? {}), ...(entry.answers ?? {}) },
    });
  }
  return [...byTemplate.values()];
}

/** Required items across the given templates that have no answer in `entries`. */
export function findMissingRequiredItems(
  templates: ChecklistTemplateLike[],
  entries: unknown,
): MissingChecklistItem[] {
  const filled = new Map(parseChecklistEntries(entries).map((e) => [e.templateId, e]));
  const missing: MissingChecklistItem[] = [];
  for (const tpl of templates) {
    const answers = filled.get(tpl.id)?.answers ?? {};
    for (const item of parseChecklistItems(tpl.items)) {
      if (!item.required) continue;
      if (!isAnswered(item.type, answers[item.key])) {
        missing.push({
          templateId: tpl.id,
          templateName: tpl.name ?? null,
          kind: String(tpl.kind),
          key: item.key,
          label: item.label,
        });
      }
    }
  }
  return missing;
}

/** Duplicate item keys inside one template (should be empty). */
export function duplicateItemKeys(items: { key: string }[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const i of items) {
    if (seen.has(i.key)) dupes.add(i.key);
    seen.add(i.key);
  }
  return [...dupes];
}
