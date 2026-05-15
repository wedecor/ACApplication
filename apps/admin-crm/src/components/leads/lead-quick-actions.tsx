'use client';

import { canTransitionLead, LeadStatus } from '@ac/types';
import { Button } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { useChangeLeadStatus } from '@/hooks/use-leads';

const NEXT_STEPS: Record<LeadStatus, { label: string; status: LeadStatus }[]> = {
  NEW: [
    { label: 'Mark contacted', status: LeadStatus.CONTACTED },
    { label: 'Qualify', status: LeadStatus.QUALIFIED },
    { label: 'Spam', status: LeadStatus.SPAM },
  ],
  CONTACTED: [
    { label: 'Qualify', status: LeadStatus.QUALIFIED },
    { label: 'Cancel', status: LeadStatus.CANCELLED },
  ],
  QUALIFIED: [{ label: 'Cancel', status: LeadStatus.CANCELLED }],
  BOOKING_CREATED: [],
  CANCELLED: [],
  SPAM: [],
};

export function LeadQuickActions({ id, current }: { id: string; current: LeadStatus }) {
  const { mutateAsync, isPending } = useChangeLeadStatus(id);
  const actions = NEXT_STEPS[current];

  if (actions.length === 0) {
    return <p className="text-xs text-muted-foreground">Lead is closed — no actions available.</p>;
  }

  const run = async (to: LeadStatus) => {
    if (!canTransitionLead(current, to)) {
      toast.error(`Cannot transition ${current} → ${to}`);
      return;
    }
    try {
      await mutateAsync({ status: to });
      toast.success(`Status set to ${to}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.status}
          size="sm"
          variant="outline"
          onClick={() => run(a.status)}
          disabled={isPending}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
