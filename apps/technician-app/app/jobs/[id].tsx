import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '../../src/lib/api';
import { type JobSummary, technicianApi } from '../../src/lib/technician-api';

const ACTION_BTN = {
  base: { padding: 14, borderRadius: 12, alignItems: 'center' as const },
  primary: { backgroundColor: '#0E7A4A' },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  warning: { backgroundColor: '#92400E' },
  danger: { backgroundColor: '#B91C1C' },
};

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [otp, setOtp] = useState('');
  const [note, setNote] = useState('');

  const job = useQuery({
    queryKey: ['job', id],
    queryFn: () => api<JobSummary>(`/bookings/${id}`),
  });

  const useJobMutation = (
    fn: () => Promise<unknown>,
    successMessage: string,
  ) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['job', id] });
        qc.invalidateQueries({ queryKey: ['jobs'] });
        Alert.alert(successMessage);
      },
      onError: (err: Error) => Alert.alert('Something went wrong', err.message),
    });

  const accept = useJobMutation(() => technicianApi.acceptJob(id!), 'On my way!');
  const start = useJobMutation(() => technicianApi.startService(id!), 'Service started');
  const waitParts = useJobMutation(() => technicianApi.waitForParts(id!), 'Waiting for parts');
  const complete = useJobMutation(() => technicianApi.completeJob(id!), 'Job completed');
  const sendOtp = useJobMutation(() => technicianApi.sendOtp(id!), 'OTP sent to customer');
  const verifyOtp = useJobMutation(() => technicianApi.verifyOtp(id!, otp), 'OTP verified');
  const addNote = useJobMutation(async () => {
    if (!note.trim()) return;
    await technicianApi.addNote(id!, note);
    setNote('');
  }, 'Note added');
  const reject = useMutation({
    mutationFn: () => technicianApi.rejectJob(id!, 'Tech unavailable'),
    onSuccess: () => {
      Alert.alert('Job released', 'Dispatch will reassign to another technician.');
      router.replace('/');
    },
  });

  if (job.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!job.data) return <View style={{ padding: 16 }}><Text>Job not found.</Text></View>;
  const j = job.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 4 }}>
        <Text style={{ color: '#94A3B8', fontSize: 12 }}>{j.code}</Text>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>
          {j.serviceType ?? j.category}
        </Text>
        <Text style={{ color: '#475569' }}>
          {j.applianceBrand ?? ''} • {j.applianceType ?? ''}
        </Text>
        <Text style={{ color: '#475569' }}>{j.issueDescription}</Text>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '600' }}>{j.customer.fullName}</Text>
          <Pressable onPress={() => Linking.openURL(`tel:${j.customer.phone}`)}>
            <Text style={{ color: '#0E7A4A', marginTop: 2 }}>{j.customer.phone}</Text>
          </Pressable>
        </View>
      </View>

      {/* Navigate */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <ActionButton
          flex={1}
          label="Navigate"
          variant="outline"
          onPress={() => {
            if (j.geoLatitude && j.geoLongitude) {
              Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${j.geoLatitude},${j.geoLongitude}`,
              );
            } else {
              Alert.alert('Address not geocoded yet.');
            }
          }}
        />
        <ActionButton
          flex={1}
          label="Reject"
          variant="danger"
          onPress={() =>
            Alert.alert('Reject this job?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reject', style: 'destructive', onPress: () => reject.mutate() },
            ])
          }
        />
      </View>

      {/* Status actions — render the next legal transition. */}
      <View style={{ marginTop: 16, gap: 12 }}>
        {j.status === 'ASSIGNED' ? (
          <ActionButton label="On my way" onPress={() => accept.mutate()} variant="primary" />
        ) : null}
        {j.status === 'TECHNICIAN_EN_ROUTE' ? (
          <>
            <ActionButton label="Send arrival OTP" onPress={() => sendOtp.mutate()} variant="outline" />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                placeholder="Enter 6-digit OTP"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              />
              <ActionButton label="Verify" variant="primary" onPress={() => verifyOtp.mutate()} />
            </View>
            <ActionButton label="Start service" variant="primary" onPress={() => start.mutate()} />
          </>
        ) : null}
        {j.status === 'IN_PROGRESS' ? (
          <>
            <ActionButton
              label="Waiting for spare parts"
              variant="warning"
              onPress={() => waitParts.mutate()}
            />
            <ActionButton label="Mark complete" variant="primary" onPress={() => complete.mutate()} />
          </>
        ) : null}
        {j.status === 'WAITING_PARTS' ? (
          <ActionButton label="Resume service" variant="primary" onPress={() => start.mutate()} />
        ) : null}
      </View>

      {/* Notes */}
      <View style={{ marginTop: 24, gap: 8 }}>
        <Text style={{ color: '#64748B', textTransform: 'uppercase', fontSize: 12, fontWeight: '700' }}>
          Add note
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="What did you find on-site?"
          style={{
            backgroundColor: '#fff',
            padding: 12,
            minHeight: 80,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        />
        <ActionButton label="Save note" onPress={() => addNote.mutate()} variant="outline" />
      </View>
    </ScrollView>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'primary',
  flex,
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'outline' | 'warning' | 'danger';
  flex?: number;
}) {
  const palette = ACTION_BTN[variant];
  const isOutline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      style={[ACTION_BTN.base, palette, flex ? { flex } : null]}
    >
      <Text style={{ color: isOutline ? '#0F172A' : '#fff', fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
