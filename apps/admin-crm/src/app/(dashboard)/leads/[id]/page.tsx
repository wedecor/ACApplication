'use client';

import { LeadStatus } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { ArrowLeft, Mail, MessageCircle, Phone, Tag } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Timeline } from '@/components/common/timeline';
import { LeadNotes } from '@/components/leads/lead-notes';
import { LeadPriorityBadge } from '@/components/leads/lead-priority-badge';
import { LeadQuickActions } from '@/components/leads/lead-quick-actions';
import { LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { useLead, useLeadActivities } from '@/hooks/use-leads';
import { useRealtime } from '@/hooks/use-realtime';
import { categoryLabel, leadSourceLabel } from '@/lib/labels';

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
        <Link
          href="/leads"
          className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Leads
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{lead.customerName}</h1>
            <LeadStatusBadge status={lead.status as LeadStatus} />
            <LeadPriorityBadge priority={lead.priority} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{lead.code}</p>
        </div>
        <LeadQuickActions id={lead.id} current={lead.status as LeadStatus} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <Timeline entries={activities as never} />
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <LeadNotes id={lead.id} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enquiry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-line break-words">{lead.issueDescription || 'No issue described.'}</p>
              <dl className="space-y-2">
                <Row label="Appliance">
                  {[categoryLabel(lead.applianceType), lead.applianceBrand].filter((v) => v && v !== '—').join(' · ') ||
                    '—'}
                </Row>
                <Row label="Address">
                  {[lead.addressLine1, lead.addressLine2, lead.landmark, lead.city?.name ?? lead.cityLabel, lead.pincode]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </Row>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="space-y-2">
                <Row label="Phone">{lead.phone}</Row>
                {lead.whatsappNumber && lead.whatsappNumber !== lead.phone ? (
                  <Row label="WhatsApp">{lead.whatsappNumber}</Row>
                ) : null}
                {lead.email ? <Row label="Email">{lead.email}</Row> : null}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={`tel:${lead.phone}`}>
                    <Phone aria-hidden /> Call
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://wa.me/${(lead.whatsappNumber ?? lead.phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle aria-hidden /> WhatsApp
                  </a>
                </Button>
                {lead.email ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${lead.email}`}>
                      <Mail aria-hidden /> Email
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <dl className="space-y-2">
                <Row label="Source">{leadSourceLabel(lead.source)}</Row>
                <Row label="Owner">
                  {lead.assignedUser
                    ? [lead.assignedUser.firstName, lead.assignedUser.lastName].filter(Boolean).join(' ') ||
                      lead.assignedUser.email
                    : 'Unassigned'}
                </Row>
                {lead.externalRef ? <Row label="External ref">{lead.externalRef}</Row> : null}
              </dl>
              {lead.tags && lead.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Tag className="size-3.5 text-muted-foreground" aria-label="Tags" />
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}
