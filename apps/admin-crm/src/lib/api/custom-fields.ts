import { apiFetch } from './client';

export const CUSTOM_FIELD_ENTITIES = ['customer', 'lead', 'booking', 'appliance'] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldDefinition {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[];
  required: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldInput {
  entity: CustomFieldEntity;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export type CustomFieldUpdate = Partial<Omit<CustomFieldInput, 'entity' | 'key'>>;

/** The API may return either a bare array or a `{ items }` wrapper — normalise. */
function asArray(data: CustomFieldDefinition[] | { items: CustomFieldDefinition[] }) {
  return Array.isArray(data) ? data : (data.items ?? []);
}

export const customFieldsApi = {
  list: async (query: { entity?: CustomFieldEntity; includeInactive?: boolean } = {}) =>
    asArray(
      await apiFetch<CustomFieldDefinition[] | { items: CustomFieldDefinition[] }>(
        '/custom-fields',
        { query },
      ),
    ),
  create: (input: CustomFieldInput) =>
    apiFetch<CustomFieldDefinition>('/custom-fields', { method: 'POST', body: input }),
  update: (id: string, input: CustomFieldUpdate) =>
    apiFetch<CustomFieldDefinition>(`/custom-fields/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => apiFetch<unknown>(`/custom-fields/${id}`, { method: 'DELETE' }),
};
