import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ApplianceCard } from '../../src/components/ApplianceCard';
import { Badge, Button, colors, SectionTitle } from '../../src/components/ui';
import { apiErrorMessage } from '../../src/lib/api';
import { formatMinor } from '../../src/lib/money';
import { technicianApi } from '../../src/lib/technician-api';

const ON_SITE = new Set(['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED']);

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [otp, setOtp] = useState('');
  const [note, setNote] = useState('');

  const job = useQuery({
    queryKey: ['job', id],
    queryFn: () => technicianApi.booking(id),
  });

  const onDone = (successMessage: string) => () => {
    void qc.invalidateQueries({ queryKey: ['job', id] });
    void qc.invalidateQueries({ queryKey: ['jobs'] });
    Alert.alert(successMessage);
  };
  const onFail = (err: unknown) => Alert.alert('Something went wrong', apiErrorMessage(err));

  const accept = useMutation({ mutationFn: () => technicianApi.acceptJob(id), onSuccess: onDone('On my way!'), onError: onFail });
  const start = useMutation({ mutationFn: () => technicianApi.startService(id), onSuccess: onDone('Service started'), onError: onFail });
  const waitParts = useMutation({ mutationFn: () => technicianApi.waitForParts(id), onSuccess: onDone('Waiting for parts'), onError: onFail });
  const complete = useMutation({ mutationFn: () => technicianApi.completeJob(id), onSuccess: onDone('Job completed'), onError: onFail });
  const sendOtp = useMutation({ mutationFn: () => technicianApi.sendOtp(id), onSuccess: onDone('OTP sent to customer'), onError: onFail });
  const verifyOtp = useMutation({ mutationFn: () => technicianApi.verifyOtp(id, otp), onSuccess: onDone('OTP verified'), onError: onFail });
  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) return;
      await technicianApi.addNote(id, note);
      setNote('');
    },
    onSuccess: onDone('Note added'),
    onError: onFail,
  });
  const reject = useMutation({
    mutationFn: () => technicianApi.rejectJob(id, 'Tech unavailable'),
    onSuccess: () => {
      Alert.alert('Job released', 'Dispatch will reassign to another technician.');
      router.replace('/');
    },
    onError: onFail,
  });

  if (job.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!job.data) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Job not found.</Text>
      </View>
    );
  }
  const j = job.data;
  const go = (path: string) => router.push(path);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.subtle, fontSize: 12 }}>{j.code}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {j.isWarrantyRevisit ? <Badge label="Warranty revisit" tone="danger" /> : null}
            <Badge label={j.status.replace(/_/g, ' ')} tone="info" />
          </View>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{j.serviceType ?? j.category}</Text>
        <Text style={{ color: '#475569' }}>
          {j.applianceBrand ?? ''} • {j.applianceType ?? ''}
          {j.serviceMode ? ` • ${j.serviceMode.replace(/_/g, ' ').toLowerCase()}` : ''}
        </Text>
        <Text style={{ color: '#475569' }}>{j.issueDescription}</Text>
        {j.estimatedAmountMinor > 0 ? (
          <Text style={{ color: colors.muted }}>Estimate {formatMinor(j.estimatedAmountMinor)}</Text>
        ) : null}
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '600' }}>{j.customer.fullName}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`tel:${j.customer.phone}`)}>
            <Text style={{ color: colors.brand, marginTop: 2 }}>{j.customer.phone}</Text>
          </Pressable>
        </View>
      </View>

      <ApplianceCard booking={j} />

      {/* Navigate */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Button
          flex={1}
          label="Navigate"
          variant="outline"
          onPress={() => {
            if (j.geoLatitude && j.geoLongitude) {
              void Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${j.geoLatitude},${j.geoLongitude}`,
              );
            } else {
              Alert.alert('Address not geocoded yet.');
            }
          }}
        />
        <Button
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
          <Button label="On my way" onPress={() => accept.mutate()} loading={accept.isPending} />
        ) : null}
        {j.status === 'TECHNICIAN_EN_ROUTE' ? (
          <>
            <Button label="Send arrival OTP" onPress={() => sendOtp.mutate()} variant="outline" loading={sendOtp.isPending} />
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
                  borderColor: colors.border,
                }}
              />
              <Button label="Verify" onPress={() => verifyOtp.mutate()} loading={verifyOtp.isPending} />
            </View>
            <Button label="Start service" onPress={() => start.mutate()} loading={start.isPending} />
          </>
        ) : null}
        {j.status === 'IN_PROGRESS' ? (
          <>
            <Button label="Waiting for spare parts" variant="warning" onPress={() => waitParts.mutate()} />
            <Button label="Finish: customer sign-off" onPress={() => go(`/signature/${id}`)} />
            <Button
              variant="outline"
              label="Mark complete without signature"
              loading={complete.isPending}
              onPress={() =>
                Alert.alert('Complete without a customer signature?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Complete', onPress: () => complete.mutate() },
                ])
              }
            />
          </>
        ) : null}
        {j.status === 'WAITING_PARTS' ? (
          <Button label="Resume service" onPress={() => start.mutate()} loading={start.isPending} />
        ) : null}
      </View>

      {/* Field tools */}
      <SectionTitle>Field tools</SectionTitle>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button flex={1} variant="outline" label="Job card" onPress={() => go(`/job-card/${id}`)} />
          <Button flex={1} variant="outline" label="Photos" onPress={() => go(`/photos/${id}`)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button flex={1} variant="outline" label="Quotation" onPress={() => go(`/quote/${id}`)} />
          <Button flex={1} variant="outline" label="Collect payment" onPress={() => go(`/payment/${id}`)} />
        </View>
        {ON_SITE.has(j.status) ? (
          <Button
            variant="outline"
            label={j.customerSignatureUrl ? 'Signature captured ✓ (redo)' : 'Customer signature'}
            onPress={() => go(`/signature/${id}`)}
          />
        ) : null}
      </View>

      {/* Notes */}
      <View style={{ marginTop: 24, gap: 8 }}>
        <Text style={{ color: colors.muted, textTransform: 'uppercase', fontSize: 12, fontWeight: '700' }}>
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
            borderColor: colors.border,
          }}
        />
        <Button label="Save note" onPress={() => addNote.mutate()} variant="outline" loading={addNote.isPending} />
      </View>
    </ScrollView>
  );
}
