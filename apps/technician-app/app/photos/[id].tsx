import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Badge, Button, Card, colors, EmptyNote, SectionTitle } from '../../src/components/ui';
import { apiErrorMessage } from '../../src/lib/api';
import { capturePhoto } from '../../src/lib/camera';
import { attachBookingPhoto } from '../../src/lib/photo-service';
import { type BookingAttachment, technicianApi } from '../../src/lib/technician-api';
import { flushWriteQueue, subscribeWriteQueue } from '../../src/lib/write-queue';
import { type AttachmentKind, pendingForBooking, type QueuedWrite } from '../../src/lib/write-queue-core';

const GROUPS: { kind: AttachmentKind; title: string; hint: string }[] = [
  { kind: 'PRE_SERVICE_PHOTO', title: 'Before service', hint: 'Unit, model plate, the fault as found' },
  { kind: 'POST_SERVICE_PHOTO', title: 'After service', hint: 'Working unit, readings, clean site' },
  { kind: 'PARTS_PHOTO', title: 'Parts', hint: 'Old part removed + new part fitted' },
  { kind: 'OTHER', title: 'Other', hint: 'Anything else worth recording' },
];

/** Before / after / parts photo capture for a booking. */
export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [busyKind, setBusyKind] = useState<AttachmentKind | null>(null);
  const [pending, setPending] = useState<QueuedWrite[]>([]);

  const attachments = useQuery({
    queryKey: ['attachments', id],
    queryFn: () => technicianApi.attachments(id),
  });

  useEffect(
    () =>
      subscribeWriteQueue((q) =>
        setPending(pendingForBooking(q, id).filter((w) => w.kind === 'photo.upload')),
      ),
    [id],
  );

  const add = async (kind: AttachmentKind, source: 'camera' | 'library') => {
    try {
      const photo = await capturePhoto(source);
      if (!photo) return;
      setBusyKind(kind);
      const res = await attachBookingPhoto(id, photo, kind);
      if (res.status === 'queued') {
        Alert.alert('Saved offline', 'The photo will upload automatically when you are back online.');
      }
      await qc.invalidateQueries({ queryKey: ['attachments', id] });
    } catch (err) {
      Alert.alert('Photo failed', apiErrorMessage(err));
    } finally {
      setBusyKind(null);
    }
  };

  const byKind = (kind: AttachmentKind): BookingAttachment[] =>
    (attachments.data ?? []).filter((a) => a.kind === kind);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={attachments.isRefetching}
          onRefresh={() => {
            void flushWriteQueue().finally(() => void attachments.refetch());
          }}
        />
      }
    >
      {pending.length > 0 ? (
        <Card style={{ backgroundColor: colors.warningBg }}>
          <Text style={{ color: colors.warning, fontWeight: '700' }}>
            {pending.length} photo{pending.length === 1 ? '' : 's'} waiting to upload
          </Text>
          <Button small variant="outline" label="Retry now" onPress={() => void flushWriteQueue()} />
        </Card>
      ) : null}
      {attachments.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      {attachments.isError ? (
        <EmptyNote>Couldn&apos;t load existing photos: {apiErrorMessage(attachments.error)}</EmptyNote>
      ) : null}
      {GROUPS.map((g) => {
        const items = byKind(g.kind);
        const queued = pending.filter((p) => p.kind === 'photo.upload' && p.attachmentKind === g.kind);
        return (
          <View key={g.kind}>
            <SectionTitle right={<Badge label={`${items.length + queued.length}`} />}>{g.title}</SectionTitle>
            <Card>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{g.hint}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {items.map((a) => (
                  <Image
                    key={a.id}
                    source={{ uri: a.url }}
                    accessibilityLabel={a.caption ?? g.title}
                    style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: '#F1F5F9' }}
                  />
                ))}
                {queued.map((q) =>
                  q.kind === 'photo.upload' ? (
                    <View key={q.id}>
                      <Image
                        source={{ uri: q.localUri }}
                        accessibilityLabel="Pending upload"
                        style={{ width: 96, height: 96, borderRadius: 10, opacity: 0.5 }}
                      />
                      <Text style={{ fontSize: 10, color: colors.warning, textAlign: 'center' }}>pending</Text>
                    </View>
                  ) : null,
                )}
                {items.length + queued.length === 0 ? <EmptyNote>No photos yet.</EmptyNote> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  flex={1}
                  label="Take photo"
                  loading={busyKind === g.kind}
                  disabled={busyKind != null}
                  onPress={() => void add(g.kind, 'camera')}
                />
                <Button
                  flex={1}
                  variant="outline"
                  label="From gallery"
                  disabled={busyKind != null}
                  onPress={() => void add(g.kind, 'library')}
                />
              </View>
            </Card>
          </View>
        );
      })}
    </ScrollView>
  );
}
