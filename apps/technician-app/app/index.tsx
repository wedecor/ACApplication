import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import { getTechnicianId } from '../src/lib/auth';
import {
  flushQueue,
  startBackgroundTracking,
  startForegroundTracking,
  stopAllTracking,
} from '../src/lib/location';
import { getSocket } from '../src/lib/socket';
import { type JobSummary, technicianApi } from '../src/lib/technician-api';

/**
 * Field-app home screen — the technician's "command bar":
 *   - Status toggle (OFFLINE ⇄ AVAILABLE) wires up GPS tracking.
 *   - Live jobs feed updates over the socket (no refresh needed).
 *   - Manual flush button drains the offline queue.
 *
 * Layout chosen for thumb reachability: primary action and status sit at
 * the top half; jobs scroll below.
 */
export default function HomeScreen() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState(false);
  const [techId, setTechId] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    void getTechnicianId().then(setTechId);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      const socket = await getSocket();
      const refetch = () => {
        void qc.invalidateQueries({ queryKey: ['jobs'] });
      };
      socket.on('booking.assigned', refetch);
      socket.on('booking.reassigned', refetch);
      socket.on('booking.status_changed', refetch);
      unsubscribe = () => {
        socket.off('booking.assigned', refetch);
        socket.off('booking.reassigned', refetch);
        socket.off('booking.status_changed', refetch);
      };
    })();
    return () => {
      unsubscribe?.();
    };
  }, [qc]);

  const jobs = useQuery({
    queryKey: ['jobs', techId],
    queryFn: () => technicianApi.myJobs(),
    enabled: !!techId,
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (!techId) throw new Error('No technician session — please log in.');
      if (next) {
        await technicianApi.setStatus(techId, 'AVAILABLE');
        await startForegroundTracking();
        await startBackgroundTracking().catch(() => undefined);
      } else {
        await technicianApi.setStatus(techId, 'OFFLINE');
        await stopAllTracking();
      }
    },
    onError: (err: Error) => Alert.alert('Status change failed', err.message),
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F7FA' }}
      refreshControl={
        <RefreshControl
          refreshing={jobs.isRefetching}
          onRefresh={() => void jobs.refetch()}
        />
      }
    >
      {/* Status card */}
      <View
        style={{
          margin: 16,
          padding: 20,
          backgroundColor: online ? '#0E7A4A' : '#1F2937',
          borderRadius: 16,
        }}
      >
        <Text style={{ color: '#fff', opacity: 0.7, fontSize: 12 }}>STATUS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>
            {online ? 'Available' : 'Offline'}
          </Text>
          <Switch
            value={online}
            disabled={toggle.isPending}
            onValueChange={(v) => {
              setOnline(v);
              setPending(true);
              toggle.mutate(v, { onSettled: () => setPending(false) });
            }}
          />
        </View>
        <Text style={{ color: '#fff', opacity: 0.85, marginTop: 8 }}>
          {online
            ? 'Sharing live location. Tap to go offline.'
            : 'Tap to go online and start receiving jobs.'}
        </Text>
        {pending ? <ActivityIndicator color="#fff" style={{ marginTop: 8 }} /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
        <Pressable
          onPress={async () => {
            const out = await flushQueue();
            setQueueSize(out.remaining);
            Alert.alert('Queue flushed', `Sent ${out.flushed}, remaining ${out.remaining}.`);
          }}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: '#fff',
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontWeight: '600' }}>Flush offline queue</Text>
          {queueSize > 0 ? (
            <Text style={{ color: '#92400E', marginTop: 2 }}>{queueSize} pending</Text>
          ) : null}
        </Pressable>
        <Link href="/inventory" asChild>
          <Pressable
            style={{
              flex: 1,
              paddingVertical: 12,
              backgroundColor: '#fff',
              borderRadius: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontWeight: '600' }}>Van inventory</Text>
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              Scan · use · return
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
          Today's jobs
        </Text>
        <View style={{ height: 12 }} />
        {jobs.isLoading ? (
          <ActivityIndicator />
        ) : jobs.data && jobs.data.length > 0 ? (
          jobs.data.map((job) => <JobCard key={job.id} job={job} />)
        ) : (
          <View style={{ padding: 24, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#64748B' }}>No jobs assigned yet.</Text>
          </View>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function JobCard({ job }: { job: JobSummary }) {
  return (
    <Link href={`/jobs/${job.id}`} asChild>
      <Pressable
        style={{
          backgroundColor: '#fff',
          padding: 14,
          marginBottom: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E2E8F0',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{job.code}</Text>
            <Text style={{ color: '#475569', marginTop: 2 }}>
              {job.customer.fullName} • {job.customer.phone}
            </Text>
            <Text style={{ color: '#64748B', marginTop: 2 }}>
              {job.serviceType ?? job.category}
              {job.applianceBrand ? ` • ${job.applianceBrand}` : ''}
            </Text>
            <Text style={{ color: '#94A3B8', marginTop: 6, fontSize: 12 }}>
              {new Date(job.scheduledAt).toLocaleString()}
              {job.scheduledTimeSlot ? ` • ${job.scheduledTimeSlot}` : ''}
            </Text>
          </View>
          <StatusPill status={job.status} />
        </View>
      </Pressable>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { fg: string; bg: string }> = {
    PENDING: { fg: '#374151', bg: '#F3F4F6' },
    ASSIGNED: { fg: '#0061C4', bg: '#DBEAFE' },
    TECHNICIAN_EN_ROUTE: { fg: '#92400E', bg: '#FEF3C7' },
    IN_PROGRESS: { fg: '#6D28D9', bg: '#EDE9FE' },
    WAITING_PARTS: { fg: '#9F1239', bg: '#FFE4E6' },
    COMPLETED: { fg: '#065F46', bg: '#D1FAE5' },
  };
  const p = palette[status] ?? { fg: '#374151', bg: '#F3F4F6' };
  return (
    <View
      style={{
        backgroundColor: p.bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: p.fg, fontSize: 11, fontWeight: '700' }}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}
