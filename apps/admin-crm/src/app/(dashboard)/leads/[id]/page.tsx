'use client';

import { LeadStatus } from '@ac/types';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { ArrowLeft, Mail, MapPin, Phone, Tag } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Timeline } from '@/components/common/timeline';
import { LeadNotes } from '@/components/leads/lead-notes';
import { LeadPriorityBadge } from '@/components/leads/lead-priority-badge';
import { LeadQuickActions } from '@/components/leads/lead-quick-actions';
import { LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { useLead, useLeadActivities } from '@/hooks/use-leads';
import { useRealtime } from '@/hooks/use-realtime';

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: lead, isLoading } = useLead(id);
  const { data: activities = [] } = useLeadActivities(id);
  useRealtime({ rooms: id ? [`lead:${id}`] : [] });

  if (isLoading || !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back to leads
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.customerName}</h1>
            <LeadStatusBadge status={lead.status as LeadStatus} />
            <LeadPriorityBadge priority={lead.priority} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{lead.code}</p>
        </div>
        <LeadQuickActions id={lead.id} current={lead.status as LeadStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <Timeline entries={activities as never} />
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <LeadNotes id={lead.id} />
            </TabsContent>
            <TabsContent value="details" className="mt-4 space-y-3">
              <DetailRow label="Issue">{lead.issueDescription ?? '—'}</DetailRow>
              <DetailRow label="Appliance">
                {[lead.applianceType, lead.applianceBrand].filter(Boolean).join(' · ') || '—'}
              </DetailRow>
              <DetailRow label="Address">
                {[lead.addressLine1, lead.addressLine2, lead.pincode].filter(Boolean).join(', ') || '—'}
              </DetailRow>
              <DetailRow label="External ref">{lead.externalRef ?? '—'}</DetailRow>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row icon={<Phone className="size-4" />} value={lead.phone} />
              {lead.whatsappNumber ? (
                <Row icon={<Phone className="size-4 text-green-600" />} value={`${lead.whatsappNumber} (WhatsApp)`} />
              ) : null}
              {lead.email ? <Row icon={<Mail className="size-4" />} value={lead.email} /> : null}
              {lead.cityLabel || lead.city ? (
                <Row icon={<MapPin className="size-4" />} value={lead.city?.name ?? lead.cityLabel ?? ''} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Meta</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Source">
                <Badge variant="outline" className="capitalize">
                  {lead.source.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </Row>
              <Separator />
              <Row label="Owner">
                {lead.assignedUser
                  ? [lead.assignedUser.firstName, lead.assignedUser.lastName].filter(Boolean).join(' ') ||
                    lead.assignedUser.email
                  : 'Unassigned'}
              </Row>
              <Separator />
              {lead.tags && lead.tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <Tag className="size-3 text-muted-foreground" />
                  {lead.tags.map((t) => (
                    <Badge key={t} variant="muted">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  children,
}: {
  icon?: React.ReactNode;
  label?: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      {label ? <span className="text-xs uppercase text-muted-foreground">{label}</span> : null}
      <span className="ml-auto">{children ?? value}</span>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-md border bg-card p-3 text-sm">
      <span className="col-span-1 text-xs uppercase text-muted-foreground">{label}</span>
      <span className="col-span-2">{children}</span>
    </div>
  );
}
