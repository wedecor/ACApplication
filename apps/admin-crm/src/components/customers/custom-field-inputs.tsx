'use client';

import { Input } from '@ac/ui';

import { Field, NativeSelect } from '@/components/common/form-field';
import type { CustomFieldDefinition } from '@/lib/api/custom-fields';

/**
 * Renders inputs for tenant-defined custom fields. Values are kept as a plain
 * object keyed by definition `key`; the API validates types server-side.
 */
export function CustomFieldInputs({
  definitions,
  values,
  onChange,
}: {
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const active = definitions.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  if (active.length === 0) return null;

  const set = (key: string, value: unknown) => {
    const next = { ...values };
    if (value === '' || value === undefined || value === null) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {active.map((def) => {
        const raw = values[def.key];
        const label = `${def.label}${def.required ? ' *' : ''}`;
        switch (def.fieldType) {
          case 'boolean':
            return (
              <Field key={def.id} label={label}>
                <NativeSelect
                  value={raw === true ? 'true' : raw === false ? 'false' : ''}
                  onChange={(e) =>
                    set(def.key, e.target.value === '' ? undefined : e.target.value === 'true')
                  }
                >
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </NativeSelect>
              </Field>
            );
          case 'select':
            return (
              <Field key={def.id} label={label}>
                <NativeSelect value={inputText(raw)} onChange={(e) => set(def.key, e.target.value)}>
                  <option value="">—</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            );
          case 'number':
            return (
              <Field key={def.id} label={label}>
                <Input
                  type="number"
                  value={inputText(raw)}
                  onChange={(e) =>
                    set(def.key, e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </Field>
            );
          case 'date':
            return (
              <Field key={def.id} label={label}>
                <Input
                  type="date"
                  value={typeof raw === 'string' ? raw.slice(0, 10) : ''}
                  onChange={(e) => set(def.key, e.target.value)}
                />
              </Field>
            );
          default:
            return (
              <Field key={def.id} label={label}>
                <Input value={inputText(raw)} onChange={(e) => set(def.key, e.target.value)} />
              </Field>
            );
        }
      })}
    </div>
  );
}

export function formatCustomFieldValue(def: CustomFieldDefinition | undefined, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (def?.fieldType === 'boolean' || typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (def?.fieldType === 'date' && typeof value === 'string') {
    return new Date(value).toLocaleDateString('en-IN');
  }
  return inputText(value);
}

/** Display text for a stored custom-field value (objects as JSON, never "[object Object]"). */
function inputText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return `${value as string | number | boolean | bigint}`;
}
