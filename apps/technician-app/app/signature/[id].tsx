import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';

import { Banner, Button, Card, colors, Field } from '../../src/components/ui';
import { apiErrorMessage, isNetworkError, isNotFound } from '../../src/lib/api';
import { repairApi } from '../../src/lib/repair-api';
import { technicianApi } from '../../src/lib/technician-api';
import { uploadLocalFile, writeDataUrlToFile } from '../../src/lib/upload';
import { enqueueWrite, flushWriteQueue } from '../../src/lib/write-queue';

// Hide the library's built-in footer — we render our own buttons.
const WEB_STYLE = `.m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad { box-shadow: none; border: none; }
  body, html { height: 100%; }`;

/**
 * Customer sign-off. The pad (react-native-signature-canvas, WebView based —
 * no extra native module beyond react-native-webview) yields a PNG data URL
 * which we persist to disk, upload via presign, then POST to
 * /bookings/:id/signature. Offline → queued.
 */
export default function SignatureCaptureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const ref = useRef<SignatureViewRef>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const booking = useQuery({ queryKey: ['job', id], queryFn: () => technicianApi.booking(id) });

  const finish = (queued: boolean) => {
    void qc.invalidateQueries({ queryKey: ['job', id] });
    const status = booking.data?.status;
    const title = queued ? 'Signature saved offline' : 'Signature saved';
    const body = queued ? 'It will upload automatically when you are back online.' : undefined;
    if (status === 'IN_PROGRESS') {
      Alert.alert(title, `${body ? `${body}\n\n` : ''}Mark the job as completed now?`, [
        { text: 'Not yet', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Complete job',
          onPress: () => {
            technicianApi
              .completeJob(id)
              .then(() => {
                void qc.invalidateQueries({ queryKey: ['jobs'] });
                void qc.invalidateQueries({ queryKey: ['job', id] });
                router.back();
              })
              .catch((err: unknown) => Alert.alert('Could not complete job', apiErrorMessage(err)));
          },
        },
      ]);
    } else {
      Alert.alert(title, body);
      router.back();
    }
  };

  const onSignature = async (dataUrl: string) => {
    setSaving(true);
    try {
      const file = await writeDataUrlToFile(dataUrl);
      if (remarks.trim()) {
        // Best effort — customer remarks live on the job card.
        await repairApi.saveJobCard(id, { customerRemarks: remarks.trim() }).catch(async (err: unknown) => {
          if (isNetworkError(err) || isNotFound(err)) {
            await enqueueWrite({ kind: 'jobcard.patch', bookingId: id, patch: { customerRemarks: remarks.trim() } });
          }
        });
      }
      try {
        const up = await uploadLocalFile({ localUri: file.uri, contentType: file.contentType });
        await technicianApi.setSignature(id, up.publicUrl);
        finish(false);
      } catch (err) {
        if (!isNetworkError(err) && !isNotFound(err)) throw err;
        await enqueueWrite({ kind: 'signature.upload', bookingId: id, localUri: file.uri });
        void flushWriteQueue().catch(() => undefined);
        finish(true);
      }
    } catch (err) {
      Alert.alert('Could not save signature', apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (booking.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  const b = booking.data;
  const canSign = b?.status === 'IN_PROGRESS' || b?.status === 'COMPLETED';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        scrollEnabled={scrollEnabled}
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Text style={{ color: colors.subtle, fontSize: 12 }}>{b?.code}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Customer sign-off</Text>
          <Text style={{ color: colors.muted }}>
            I, {b?.customer.fullName ?? 'the customer'}, confirm the work was carried out to my satisfaction.
          </Text>
        </Card>

        {!canSign && b ? (
          <Banner
            tone="warning"
            title="Start the service first"
            body="A signature can only be captured while the job is in progress or completed."
          />
        ) : null}

        {b?.customerSignatureUrl ? (
          <Card>
            <Text style={{ fontWeight: '600' }}>Signature on file</Text>
            <Image
              source={{ uri: b.customerSignatureUrl }}
              accessibilityLabel="Existing customer signature"
              resizeMode="contain"
              style={{ height: 120, backgroundColor: '#fff' }}
            />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Capturing again replaces it.</Text>
          </Card>
        ) : null}

        <View
          style={{
            height: 260,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: '#fff',
          }}
        >
          <SignatureScreen
            ref={ref}
            webStyle={WEB_STYLE}
            descriptionText=""
            imageType="image/png"
            trimWhitespace
            penColor="#0F172A"
            backgroundColor="#FFFFFF"
            onBegin={() => {
              setScrollEnabled(false);
              setHasInk(true);
            }}
            onEnd={() => setScrollEnabled(true)}
            onClear={() => setHasInk(false)}
            onEmpty={() => Alert.alert('Signature is empty', 'Ask the customer to sign in the box.')}
            onOK={(sig) => void onSignature(sig)}
          />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>Sign inside the box</Text>

        <Field
          label="Customer remarks (optional)"
          multiline
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Anything the customer wants recorded"
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button flex={1} variant="outline" label="Clear" onPress={() => ref.current?.clearSignature()} />
          <Button
            flex={2}
            label="Save signature"
            loading={saving}
            disabled={!hasInk || !canSign}
            onPress={() => ref.current?.readSignature()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
