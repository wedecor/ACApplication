'use client';

import { Permission, type ServiceCategory } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { Map, Pencil, Plus, Power, Star, Wrench } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { STATUS_COLOR } from '@/components/dispatch/status-colors';
import { DeactivateTechnicianDialog } from '@/components/technicians/deactivate-technician-dialog';
import { TechnicianFormModal } from '@/components/technicians/technician-form-modal';
import {
  useReactivateTechnician,
  useTechnician,
  useTechnicianFormOptions,
  useTechnicians,
} from '@/hooks/use-technicians';
import { useAvailability } from '@/hooks/use-tracking';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { TechnicianListItem, TechnicianListQuery } from '@/lib/api/technicians';
import type { TechnicianStatus } from '@/lib/api/tracking';
import { formatDateTime } from '@/lib/format';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

const PRESENCE: TechnicianStatus[] = [
  'AVAILABLE',
  'ONLINE',
  'BUSY',
  'EN_ROUTE',
  'WORKING',
  'ON_BREAK',
  'OFFLINE',
  'UNREACHABLE',
];

export default function TechniciansPage() {
  const { permissions } = readSessionClaims();
  const canRead = hasPermission(Permission.TECHNICIAN_READ, permissions);
  const canOnboard = hasPermission(Permission.TECHNICIAN_ONBOARD, permissions);
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            <Wrench className="size-5" />
            Technicians
          </h1>
          <p className="text-sm text-muted-foreground">
            Onboard and manage the field team, and watch live availability.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/live-map">
              <Map className="size-4" />
              Live map
            </Link>
          </Button>
          {canOnboard ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add technician
            </Button>
          ) : null}
        </div>
      </header>

      <Tabs defaultValue={canRead ? 'roster' : 'live'}>
        <TabsList>
          {canRead ? <TabsTrigger value="roster">Roster</TabsTrigger> : null}
          <TabsTrigger value="live">Live availability</TabsTrigger>
        </TabsList>
        {canRead ? (
          <TabsContent value="roster">
            <RosterTab />
          </TabsContent>
        ) : null}
        <TabsContent value="live">
          <LiveAvailabilityTab />
        </TabsContent>
      </Tabs>

      <TechnicianFormModal open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  );
}

// --------------------------------------------------------------------- roster
function RosterTab() {
  const { permissions } = readSessionClaims();
  const canWrite = hasPermission(Permission.TECHNICIAN_WRITE, permissions);
  const { data: options } = useTechnicianFormOptions();
  const [query, setQuery] = React.useState<TechnicianListQuery>({ page: 1, pageSize: 20 });
  const [search, setSearch] = React.useState('');
  const { data, isLoading, error } = useTechnicians(query);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [deactivating, setDeactivating] = React.useState<TechnicianListItem | null>(null);
  const reactivate = useReactivateTechnician();

  React.useEffect(() => {
    const t = setTimeout(() => setQuery((q) => ({ ...q, search: search || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const patch = (p: Partial<TechnicianListQuery>) => setQuery((q) => ({ ...q, ...p, page: 1 }));
  const items = data?.items ?? [];

  const onReactivate = async (t: TechnicianListItem) => {
    try {
      await reactivate.mutateAsync(t.id);
      toast.success(`${t.fullName} reactivated`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reactivate'));
    }
  };

  const selectCls = 'h-9 rounded-md border bg-background px-2 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-9 w-64"
          placeholder="Search name, phone, employee code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search technicians"
        />
        <select
          className={selectCls}
          aria-label="City"
          value={query.cityId ?? ''}
          onChange={(e) => patch({ cityId: e.target.value || undefined })}
        >
          <option value="">All cities</option>
          {options?.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          aria-label="Presence"
          value={query.status?.[0] ?? ''}
          onChange={(e) => patch({ status: e.target.value ? [e.target.value as TechnicianStatus] : undefined })}
        >
          <option value="">Any presence</option>
          {PRESENCE.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          aria-label="Skill"
          value={query.skill?.[0] ?? ''}
          onChange={(e) => patch({ skill: e.target.value ? [e.target.value as ServiceCategory] : undefined })}
        >
          <option value="">Any skill</option>
          {options?.skills.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          aria-label="Account status"
          value={query.accountStatus ?? ''}
          onChange={(e) =>
            patch({ accountStatus: (e.target.value || undefined) as TechnicianListQuery['accountStatus'] })
          }
        >
          <option value="">Active + deactivated</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Deactivated</option>
        </select>
      </div>

      {error ? <LoadError label="technicians" message={apiErrorMessage(error)} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Presence</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead>Account</TableHead>
                {canWrite ? <TableHead className="sr-only">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <EmptyState
                      icon={Wrench}
                      title="No technicians match"
                      description="Adjust the filters or add a technician."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((t) => {
                  const suspended = t.user.status !== 'ACTIVE';
                  return (
                    <TableRow key={t.id} className={suspended ? 'opacity-60' : undefined}>
                      <TableCell>
                        <Link href={`/technicians/${t.id}`} className="font-medium hover:underline">
                          {t.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t.employeeCode} · {t.phone}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{t.city.name}</TableCell>
                      <TableCell className="max-w-[16rem]">
                        <div className="flex flex-wrap gap-1">
                          {t.skills.slice(0, 3).map((s) => (
                            <Badge key={s} variant="muted" className="text-[10px]">
                              {s.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {t.skills.length > 3 ? (
                            <Badge variant="outline" className="text-[10px]">
                              +{t.skills.length - 3}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <PresenceBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.rating.toFixed(1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.totalJobs}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.openBookings}</TableCell>
                      <TableCell>
                        {suspended ? (
                          <Badge variant="destructive">Deactivated</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                      {canWrite ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${t.fullName}`}
                              onClick={() => setEditId(t.id)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {suspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reactivate.isPending}
                                onClick={() => void onReactivate(t)}
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Deactivate ${t.fullName}`}
                                onClick={() => setDeactivating(t)}
                              >
                                <Power className="size-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data ? (
        <Pagination
          page={data.pagination.page}
          pageSize={data.pagination.pageSize}
          total={data.pagination.total}
          totalPages={data.pagination.totalPages}
          onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
        />
      ) : null}

      <EditTechnicianLoader id={editId} onClose={() => setEditId(null)} />
      <DeactivateTechnicianDialog
        technician={deactivating}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
      />
    </div>
  );
}

/** Loads the full detail (working hours, documents) before opening the edit form. */
function EditTechnicianLoader({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error } = useTechnician(id ?? undefined);
  React.useEffect(() => {
    if (error) {
      toast.error(apiErrorMessage(error, 'Failed to load technician'));
      onClose();
    }
  }, [error, onClose]);
  if (!id || !data) return null;
  return (
    <TechnicianFormModal
      open
      technician={data}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}

function PresenceBadge({ status }: { status: TechnicianStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <Badge variant="outline" style={{ borderColor: c.fg, color: c.fg, backgroundColor: c.bg }}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ---------------------------------------------------------- live availability
function LiveAvailabilityTab() {
  const { data, isLoading, error } = useAvailability(null);
  const technicians = data?.technicians ?? [];
  const buckets = data?.buckets;

  return (
    <div className="space-y-4">
      {buckets ? (
        <div className="grid gap-3 sm:grid-cols-5">
          <Bucket label="Available" value={buckets.available} />
          <Bucket label="Engaged" value={buckets.engaged} />
          <Bucket label="On break" value={buckets.onBreak} />
          <Bucket label="Offline" value={buckets.offline} />
          <Bucket label="Unreachable" value={buckets.unreachable} />
        </div>
      ) : null}

      {error ? <LoadError label="technicians" message={(error).message} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Acceptance</TableHead>
                <TableHead className="text-right">Active jobs</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : technicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={Wrench}
                      title="No technicians"
                      description="Add technicians from the Roster tab or check tracking permissions."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                technicians.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link href={`/technicians/${t.id}`} className="hover:underline">
                        {t.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <PresenceBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-1 tabular-nums">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {t.rating.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(t.acceptanceRate * 100)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t._count.bookings}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.lastSeenAt ? formatDateTime(t.lastSeenAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
