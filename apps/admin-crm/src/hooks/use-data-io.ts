'use client';

import { useMutation } from '@tanstack/react-query';

import {
  dataIoApi,
  type ExportEntity,
  type ExportFilters,
  type ImportEntity,
} from '@/lib/api/data-io';

export function useExportCsv() {
  return useMutation({
    mutationFn: ({ entity, filters }: { entity: ExportEntity; filters: ExportFilters }) =>
      dataIoApi.downloadExport(entity, filters),
  });
}

export function useImportTemplate() {
  return useMutation({ mutationFn: (entity: ImportEntity) => dataIoApi.downloadTemplate(entity) });
}

export function useRunImport() {
  return useMutation({
    mutationFn: ({ entity, csv, dryRun }: { entity: ImportEntity; csv: string; dryRun: boolean }) =>
      dataIoApi.runImport(entity, csv, dryRun),
  });
}
