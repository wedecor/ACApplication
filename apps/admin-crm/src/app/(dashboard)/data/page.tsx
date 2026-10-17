'use client';

import { Badge, Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ac/ui';
import { Download, FileUp, Upload } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, StatCard } from '@/components/common/form-field';
import { useExportCsv, useImportTemplate, useRunImport } from '@/hooks/use-data-io';
import {
  EXPORT_ENTITIES,
  type ExportEntity,
  IMPORT_ENTITIES,
  type ImportEntity,
  type ImportReport,
} from '@/lib/api/data-io';
import { errorMessage } from '@/lib/crm-format';
import { humanizeEnum } from '@/lib/labels';

const MAX_BYTES = 5 * 1024 * 1024;

export default function DataPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Data import &amp; export</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-load customers, leads and appliances from CSV (validated with a dry run first), and export CRM data as CSV.
        </p>
      </header>
      <ImportSection />
      <ExportSection />
    </div>
  );
}

function ImportSection() {
  const [entity, setEntity] = React.useState<ImportEntity>('customers');
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [csv, setCsv] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const template = useImportTemplate();
  const run = useRunImport();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setCsv(null);
    setFileName(null);
    setReport(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (file: File | undefined) => {
    setReport(null);
    if (!file) return reset();
    if (file.size > MAX_BYTES) {
      toast.error('File is larger than 5 MB');
      return reset();
    }
    setFileName(file.name);
    setCsv(await file.text());
  };

  const execute = async (dryRun: boolean) => {
    if (!csv) return;
    try {
      const r = await run.mutateAsync({ entity, csv, dryRun });
      setReport(r);
      if (!dryRun) toast.success(`Imported ${r.created} ${entity}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Import failed'));
    }
  };

  const canCommit = report?.dryRun && report.valid > 0;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <Upload className="size-4" /> Import
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Entity" className="w-44">
          <NativeSelect
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as ImportEntity);
              setReport(null);
            }}
          >
            {IMPORT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="CSV file (max 5 MB, 5 000 rows)">
          <Input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
        </Field>
        <Button
          variant="outline"
          disabled={template.isPending}
          onClick={() => template.mutate(entity, { onError: (err) => toast.error(errorMessage(err)) })}
        >
          <Download className="mr-1 size-4" /> Template
        </Button>
        <Button variant="secondary" disabled={!csv || run.isPending} onClick={() => void execute(true)}>
          <FileUp className="mr-1 size-4" /> Validate (dry run)
        </Button>
        <Button
          disabled={!canCommit || run.isPending}
          onClick={() => {
            if (report && window.confirm(`Import ${report.valid} valid row(s)? Rows with errors or duplicates are skipped.`)) {
              void execute(false);
            }
          }}
        >
          Import valid rows
        </Button>
        {fileName ? (
          <Button variant="ghost" onClick={reset}>
            Clear
          </Button>
        ) : null}
      </div>
      {fileName ? <p className="text-xs text-muted-foreground">Selected: {fileName}</p> : null}
      {report ? <ImportReportView report={report} /> : null}
    </section>
  );
}

function ImportReportView({ report }: { report: ImportReport }) {
  const rows = [
    ...report.errors.map((e) => ({ row: e.row, kind: 'error' as const, field: e.field ?? '', message: e.message })),
    ...report.duplicates.map((d) => ({
      row: d.row,
      kind: 'duplicate' as const,
      field: '',
      message: `${d.reason} (existing ${d.existingId})`,
    })),
  ].sort((a, b) => a.row - b.row);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={report.dryRun ? 'info' : 'success'}>{report.dryRun ? 'Dry run' : 'Imported'}</Badge>
        <span className="text-sm text-muted-foreground">{report.entity}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <StatCard label="Rows" value={report.total} />
        <StatCard label="Valid" value={report.valid} />
        <StatCard label="Created" value={report.created} />
        <StatCard label="Skipped" value={report.skipped} />
        <StatCard label="Problems" value={rows.length} />
      </div>
      {rows.length > 0 ? (
        <div className="max-h-96 overflow-auto rounded-lg border">
          <Table stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Row</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-40">Field</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 500).map((r, i) => (
                <TableRow key={`${r.row}-${i}`}>
                  <TableCell className="tabular-nums">{r.row}</TableCell>
                  <TableCell>
                    <Badge variant={r.kind === 'error' ? 'destructive' : 'warning'}>{humanizeEnum(r.kind)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.field || '—'}</TableCell>
                  <TableCell className="text-sm">{r.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No problems found.</p>
      )}
    </div>
  );
}

function ExportSection() {
  const [entity, setEntity] = React.useState<ExportEntity>('customers');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const exporter = useExportCsv();

  const onExport = () => {
    exporter.mutate(
      {
        entity,
        filters: {
          from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
          status: status.trim() || undefined,
          search: search.trim() || undefined,
        },
      },
      {
        onSuccess: () => toast.success('Export downloaded'),
        onError: (err) => toast.error(errorMessage(err, 'Export failed')),
      },
    );
  };

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <Download className="size-4" /> Export
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Entity" className="w-44">
          <NativeSelect value={entity} onChange={(e) => setEntity(e.target.value as ExportEntity)}>
            {EXPORT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Created from">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Created to">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Status (optional)" className="w-40">
          <Input value={status} onChange={(e) => setStatus(e.target.value.toUpperCase())} placeholder="e.g. COMPLETED" />
        </Field>
        <Field label="Search (optional)" className="w-48">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Button disabled={exporter.isPending} onClick={onExport}>
          <Download className="mr-1 size-4" /> {exporter.isPending ? 'Exporting…' : 'Download CSV'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Exports never include password hashes, OTP hashes or tokens. Large exports stream directly to your browser.
      </p>
    </section>
  );
}
