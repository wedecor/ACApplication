'use client';

import * as React from 'react';
import { Clock, Plus, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { useSlaActions, useSlaProfiles } from '@/hooks/use-support';

export default function SlaPage() {
  const profiles = useSlaProfiles();
  const sla = useSlaActions();
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({
    name: '',
    firstResponseMinutes: 30,
    resolutionMinutes: 480,
    businessHoursOnly: false,
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Clock className="size-5" />
            SLA profiles
          </h1>
          <p className="text-sm text-muted-foreground">
            First-response and resolution targets, with optional business-hours scoping and
            priority overrides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={sla.scan.isPending}
            onClick={() => sla.scan.mutate()}
          >
            <RefreshCw className="size-4" />
            Run scan
          </Button>
          <Button onClick={() => setCreating((p) => !p)}>
            <Plus className="size-4" />
            {creating ? 'Cancel' : 'New SLA'}
          </Button>
        </div>
      </header>

      {creating ? (
        <div className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-semibold">New SLA profile</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Profile name (e.g. Premium)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              type="number"
              placeholder="First response (min)"
              value={draft.firstResponseMinutes}
              onChange={(e) =>
                setDraft({ ...draft, firstResponseMinutes: Number(e.target.value) })
              }
            />
            <Input
              type="number"
              placeholder="Resolution (min)"
              value={draft.resolutionMinutes}
              onChange={(e) =>
                setDraft({ ...draft, resolutionMinutes: Number(e.target.value) })
              }
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.businessHoursOnly}
              onChange={(e) => setDraft({ ...draft, businessHoursOnly: e.target.checked })}
            />
            Track only during business hours (9 AM – 6 PM, Mon–Sat)
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.name || sla.create.isPending}
              onClick={() =>
                sla.create.mutate(draft, {
                  onSuccess: () => {
                    setDraft({
                      name: '',
                      firstResponseMinutes: 30,
                      resolutionMinutes: 480,
                      businessHoursOnly: false,
                    });
                    setCreating(false);
                  },
                })
              }
            >
              Create
            </Button>
          </div>
        </div>
      ) : null}

      {profiles.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !profiles.data || profiles.data.length === 0 ? (
        <EmptyState
          title="No SLA profiles"
          description="Create a default profile to start tracking first-response and resolution SLAs."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>First response</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>Business hours</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="tabular-nums">{p.firstResponseMinutes}m</TableCell>
                  <TableCell className="tabular-nums">{p.resolutionMinutes}m</TableCell>
                  <TableCell>{p.businessHoursOnly ? 'Yes' : '24x7'}</TableCell>
                  <TableCell>{p.isDefault ? <Badge>Default</Badge> : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? 'default' : 'outline'}>
                      {p.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
