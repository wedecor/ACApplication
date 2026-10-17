'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { ArrowLeft, Check, Minus, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { errorMessage, JobCardStatusBadge } from '@/components/repair/repair-ui';
import { useJobCard } from '@/hooks/use-repair';
import { type ChecklistItem, type ChecklistTemplate, humanize, type JobCard } from '@/lib/api/repair';
import { formatDateTime, formatMinor } from '@/lib/format';

export default function JobCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useJobCard(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-destructive">{error ? errorMessage(error) : 'Job card not found'}</p>
      </div>
    );
  }

  const jc = data;
  const readings = Object.entries(jc.readings ?? {});

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Job card · {jc.booking?.code}</h1>
            <JobCardStatusBadge status={jc.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {jc.booking?.customer.fullName} · {humanize(jc.booking?.category)}
            {jc.technician ? ` · ${jc.technician.fullName}` : ''}
          </p>
        </div>
        {jc.booking ? (
          <Link href={`/bookings/${jc.booking.id}`} className="text-sm text-primary hover:underline">
            Open booking →
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Section label="Symptoms">
                {jc.symptoms.length ? (
                  <div className="flex flex-wrap gap-1">
                    {jc.symptoms.map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  '—'
                )}
              </Section>
              <Section label="Fault codes">{jc.faultCodes.join(', ') || '—'}</Section>
              <Section label="Diagnosis">{jc.diagnosis ?? '—'}</Section>
              <Section label="Root cause">{jc.rootCause ?? '—'}</Section>
              <Section label="Resolution">{jc.resolution ?? '—'}</Section>
              <Section label="Technician remarks">{jc.technicianRemarks ?? '—'}</Section>
              <Section label="Customer remarks">{jc.customerRemarks ?? '—'}</Section>
            </CardContent>
          </Card>

          {data.templates.map((tpl) => (
            <ChecklistCard key={tpl.id} template={tpl} jobCard={jc} />
          ))}

          {jc.photos.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Photos</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {jc.photos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Job card attachment" className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Kv label="Started">{formatDateTime(jc.startedAt)}</Kv>
              <Kv label="Completed">{formatDateTime(jc.completedAt)}</Kv>
              <Kv label="First-time fix">{jc.firstTimeFix == null ? '—' : jc.firstTimeFix ? 'Yes' : 'No'}</Kv>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Readings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {readings.length ? (
                readings.map(([k, v]) => (
                  <Kv key={k} label={k}>
                    {display(v)}
                  </Kv>
                ))
              ) : (
                <p className="text-muted-foreground">No readings recorded.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parts recommended</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {jc.partsRecommended.length ? (
                jc.partsRecommended.map((p, i) => (
                  <Kv key={i} label={display(p.name ?? p.sku ?? `Part ${i + 1}`)}>
                    {p.qty != null ? `× ${display(p.qty)}` : ''}
                    {typeof p.unitPriceMinor === 'number' ? ` · ${formatMinor(p.unitPriceMinor)}` : ''}
                  </Kv>
                ))
              ) : (
                <p className="text-muted-foreground">None.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ChecklistCard({ template, jobCard }: { template: ChecklistTemplate; jobCard: JobCard }) {
  const answers = jobCard.checklist.find((c) => c.templateId === template.id)?.answers ?? {};
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{template.name}</CardTitle>
        <Badge variant="outline">{humanize(template.kind)}</Badge>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {template.items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-2">
              <span>
                {item.label}
                {item.required ? <span className="text-destructive"> *</span> : null}
              </span>
              <Answer item={item} value={answers[item.key]} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Answer({ item, value }: { item: ChecklistItem; value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return <Minus className="size-4 text-muted-foreground" aria-label="Not answered" />;
  }
  if (item.type === 'bool') {
    return value === true ? (
      <Check className="size-4 text-green-600" aria-label="Yes" />
    ) : (
      <X className="size-4 text-destructive" aria-label="No" />
    );
  }
  if (item.type === 'photo') {
    const url = display(Array.isArray(value) ? (value as unknown[])[0] : value);
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
        View photo
      </a>
    );
  }
  return (
    <span className="tabular-nums">
      {display(value)}
      {item.unit ? ` ${item.unit}` : ''}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/job-cards" className="text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="inline size-4" /> Back to job cards
    </Link>
  );
}

/** Render an arbitrary JSON value from the job card as text. */
function display(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
