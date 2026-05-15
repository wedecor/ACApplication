'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';

import { useAmcPlans, useAmcSubscriptions } from '@/hooks/use-finance';
import type { AMCSubscriptionStatus, AmcPlan, AmcSubscription } from '@/lib/api/amc';
import { formatDate, formatMinor } from '@/lib/format';

const STATUS_BADGE: Record<AMCSubscriptionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  EXPIRED: 'destructive',
  CANCELLED: 'outline',
  PENDING_PAYMENT: 'secondary',
};

export default function AmcPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">AMC</h1>
        <p className="text-sm text-muted-foreground">
          Annual maintenance contracts — plans, subscriptions and renewals.
        </p>
      </header>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <SubscriptionsTab />
        </TabsContent>
        <TabsContent value="plans">
          <PlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubscriptionsTab() {
  const [status, setStatus] = React.useState<AMCSubscriptionStatus | undefined>(undefined);
  const { data, isLoading } = useAmcSubscriptions({ status });

  const buckets: Array<{ status?: AMCSubscriptionStatus; label: string }> = [
    { status: undefined, label: 'All' },
    { status: 'ACTIVE', label: 'Active' },
    { status: 'PENDING_PAYMENT', label: 'Awaiting payment' },
    { status: 'EXPIRED', label: 'Expired' },
    { status: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
        {buckets.map((b) => (
          <button
            key={b.label}
            onClick={() => setStatus(b.status)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              status === b.status
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No subscriptions"
          description="Subscriptions will appear here once customers sign up for an AMC plan."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((sub) => (
            <SubscriptionCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionCard({ sub }: { sub: AmcSubscription }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground">{sub.number}</div>
            <div className="text-sm font-semibold">{sub.customer?.fullName ?? '—'}</div>
          </div>
          <Badge variant={STATUS_BADGE[sub.status]}>{sub.status}</Badge>
        </div>
        <div className="text-sm">
          Plan <span className="font-medium">{sub.plan?.name ?? sub.planId}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatDate(sub.startsAt)} → {formatDate(sub.endsAt)}
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Visits</span>
          <span className="tabular-nums">
            {sub.visitsCompleted} / {sub.visitsScheduled}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="tabular-nums">{formatMinor(sub.priceMinor)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Auto-renew</span>
          <span>{sub.autoRenew ? 'Yes' : 'No'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PlansTab() {
  const { data, isLoading } = useAmcPlans();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No plans yet"
        description="Create your first AMC plan to start selling annual contracts."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: AmcPlan }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{plan.name}</CardTitle>
          <Badge variant="outline">{plan.type}</Badge>
        </div>
        <CardDescription>{plan.description ?? '—'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Duration</span>
          <span>{plan.durationMonths} months</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Visits included</span>
          <span>{plan.includedVisits}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Price</span>
          <span className="tabular-nums font-medium">{formatMinor(plan.priceMinor)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Emergency / priority</span>
          <span>
            {plan.emergencySupport ? '24×7 ✓' : '—'} /{' '}
            {plan.prioritySupport ? 'priority ✓' : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
