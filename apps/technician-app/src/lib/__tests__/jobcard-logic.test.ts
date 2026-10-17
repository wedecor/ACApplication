import { describe, expect, it } from 'vitest';

import {
  buildReadings,
  checklistProgress,
  emptyJobCardForm,
  findMissingRequired,
  formatMissingItems,
  formFromJobCard,
  formToPatch,
  isAnswered,
  parseMissingItems,
  parseReading,
  setAnswer,
  summarizeWarranty,
  symptomOptions,
  toggleInList,
} from '../jobcard-logic';
import type { ChecklistTemplate, JobCard } from '../repair-types';

const safety: ChecklistTemplate = {
  id: 't-safety',
  kind: 'SAFETY',
  name: 'Safety',
  items: [
    { key: 'mcbOff', label: 'MCB switched off', type: 'bool', required: true },
    { key: 'gasPressurePsi', label: 'Gas pressure', type: 'number', unit: 'psi', required: true },
    { key: 'currentAmps', label: 'Current', type: 'number', unit: 'A', required: false },
    { key: 'sitePhoto', label: 'Site photo', type: 'photo', required: true },
    { key: 'remarks', label: 'Remarks', type: 'text', required: false },
  ],
};

describe('checklist answers', () => {
  it('treats false as an answer for bool, rejects blank strings / NaN', () => {
    expect(isAnswered({ type: 'bool' }, false)).toBe(true);
    expect(isAnswered({ type: 'bool' }, undefined)).toBe(false);
    expect(isAnswered({ type: 'number' }, Number.NaN)).toBe(false);
    expect(isAnswered({ type: 'number' }, 0)).toBe(true);
    expect(isAnswered({ type: 'text' }, '   ')).toBe(false);
    expect(isAnswered({ type: 'photo' }, 'https://x/y.jpg')).toBe(true);
  });

  it('finds missing required items and tracks progress', () => {
    let checklist = setAnswer([], safety, 'mcbOff', false);
    checklist = setAnswer(checklist, safety, 'currentAmps', 4.2);
    const missing = findMissingRequired([safety], checklist).map((m) => m.key);
    expect(missing).toEqual(['gasPressurePsi', 'sitePhoto']);
    expect(checklistProgress(safety, checklist)).toEqual({ answered: 2, total: 5, requiredMissing: 2 });

    checklist = setAnswer(checklist, safety, 'gasPressurePsi', 68);
    checklist = setAnswer(checklist, safety, 'sitePhoto', 'https://cdn/x.jpg');
    expect(findMissingRequired([safety], checklist)).toEqual([]);
  });

  it('setAnswer is immutable and undefined clears', () => {
    const a = setAnswer([], safety, 'mcbOff', true);
    const b = setAnswer(a, safety, 'mcbOff', undefined);
    expect(a[0]?.answers).toEqual({ mcbOff: true });
    expect(b[0]?.answers).toEqual({});
    expect(b).toHaveLength(1);
  });

  it('derives readings from number items only', () => {
    let checklist = setAnswer([], safety, 'gasPressurePsi', 68);
    checklist = setAnswer(checklist, safety, 'remarks', 'ok');
    expect(buildReadings([safety], checklist)).toEqual({ gasPressurePsi: 68 });
  });
});

describe('form mapping', () => {
  it('round-trips symptom notes and blanks', () => {
    const form = {
      ...emptyJobCardForm(),
      symptoms: ['Not cooling'],
      symptomNotes: 'Trips after 2h\n\n',
      diagnosis: '  ',
      resolution: 'Recharged gas',
    };
    const patch = formToPatch(form, []);
    expect(patch.symptoms).toEqual(['Not cooling', 'Note: Trips after 2h']);
    expect(patch.diagnosis).toBeNull();
    const jc: JobCard = {
      id: 'j1',
      status: 'IN_PROGRESS',
      symptoms: patch.symptoms ?? [],
      faultCodes: ['E4'],
      diagnosis: null,
      rootCause: null,
      resolution: 'Recharged gas',
      readings: {},
      checklist: [],
      partsRecommended: [{ name: 'Capacitor', quantity: 2 }, 'junk'],
      photos: [],
      firstTimeFix: true,
      technicianRemarks: null,
      customerRemarks: null,
    };
    const back = formFromJobCard(jc);
    expect(back.symptoms).toEqual(['Not cooling']);
    expect(back.symptomNotes).toBe('Trips after 2h');
    expect(back.partsRecommended).toEqual([{ name: 'Capacitor', quantity: 2 }]);
  });
});

describe('misc helpers', () => {
  it('parses readings leniently', () => {
    expect(parseReading('')).toBeUndefined();
    expect(parseReading('68.5')).toBe(68.5);
    expect(parseReading('68,5')).toBe(68.5);
    expect(parseReading('-3')).toBe(-3);
    expect(parseReading('abc')).toBeNull();
  });

  it('toggles list membership', () => {
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('picks symptom presets by category', () => {
    expect(symptomOptions('AC')).toContain('Not cooling');
    expect(symptomOptions('unknown-thing')).toContain('Not turning on');
  });

  it('summarises warranty with repair warranty taking priority', () => {
    const s = summarizeWarranty({
      manufacturer: { active: true, until: '2027-01-01T00:00:00Z' },
      extended: { active: false, until: null },
      repair: { active: true, until: '2026-12-01T00:00:00Z', bookingId: 'b0' },
      amcCovered: false,
    });
    expect(s.covered).toBe(true);
    expect(s.headline).toBe('Under repair warranty');
    expect(s.lines).toHaveLength(2);
    expect(summarizeWarranty(null).covered).toBe(false);
  });
});

describe('CHECKLIST_INCOMPLETE details', () => {
  it('parses error.details.missing and formats it', () => {
    const items = parseMissingItems({
      code: 'CHECKLIST_INCOMPLETE',
      missing: [
        { templateId: 't1', templateName: 'Safety', kind: 'SAFETY', key: 'mcbOff', label: 'MCB off' },
        { nope: true },
        'junk',
      ],
    });
    expect(items).toEqual([{ templateId: 't1', templateName: 'Safety', kind: 'SAFETY', key: 'mcbOff', label: 'MCB off' }]);
    expect(formatMissingItems(items)).toBe('• Safety: MCB off');
    expect(parseMissingItems(null)).toEqual([]);
  });
});
