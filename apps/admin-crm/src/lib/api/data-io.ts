import { env } from '@/env';

import { getAccessToken } from './auth-token';
import { apiFetch, ApiClientError } from './client';

export const EXPORT_ENTITIES = [
  'customers',
  'leads',
  'bookings',
  'invoices',
  'appliances',
  'tasks',
] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

export const IMPORT_ENTITIES = ['customers', 'leads', 'appliances'] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export interface ExportFilters {
  from?: string;
  to?: string;
  status?: string;
  cityId?: string;
  search?: string;
}

export interface ImportReport {
  entity: ImportEntity;
  dryRun: boolean;
  total: number;
  valid: number;
  created: number;
  skipped: number;
  errors: { row: number; field?: string; message: string }[];
  duplicates: { row: number; existingId: string; reason: string }[];
}

function apiBase(): string {
  return `${env.NEXT_PUBLIC_API_URL}/api/v1`;
}

async function fetchCsv(path: string, query: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const qs = params.toString();
  const token = getAccessToken();
  const res = await fetch(`${apiBase()}${path}${qs ? `?${qs}` : ''}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { code?: string; details?: unknown };
    } | null;
    throw new ApiClientError(res.status, json?.error?.code ?? 'EXPORT_FAILED', json?.error?.details);
  }
  return res.blob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const dataIoApi = {
  /** Streams the CSV from the API and saves it as a browser download. */
  downloadExport: async (entity: ExportEntity, filters: ExportFilters = {}) => {
    const blob = await fetchCsv(`/data/export/${entity}`, { ...filters });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(blob, `${entity}-${stamp}.csv`);
  },
  downloadTemplate: async (entity: ImportEntity) => {
    const blob = await fetchCsv(`/data/import/${entity}/template`);
    triggerDownload(blob, `${entity}-import-template.csv`);
  },
  runImport: (entity: ImportEntity, csv: string, dryRun: boolean) =>
    apiFetch<ImportReport>(`/data/import/${entity}`, { method: 'POST', body: { csv, dryRun } }),
};
