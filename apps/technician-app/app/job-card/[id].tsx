import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ChecklistSection } from '../../src/components/ChecklistSection';
import { FaultCodePicker } from '../../src/components/FaultCodePicker';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  colors,
  EmptyNote,
  Field,
  SectionTitle,
  YesNo,
} from '../../src/components/ui';
import { VanPartsPicker } from '../../src/components/VanPartsPicker';
import {
  apiErrorCode,
  apiErrorDetails,
  apiErrorMessage,
  apiStatus,
  isNetworkError,
  isNotFound,
} from '../../src/lib/api';
import { humanizeStatus } from '../../src/lib/format';
import {
  clearJobCardDraft,
  loadJobCardDraft,
  loadJobCardSnapshot,
  saveJobCardDraft,
  saveJobCardSnapshot,
} from '../../src/lib/jobcard-draft';
import {
  buildReadings,
  findMissingRequired,
  formatMissingItems,
  formFromJobCard,
  formToPatch,
  type JobCardForm,
  parseMissingItems,
  setAnswer,
  symptomOptions,
  toggleInList,
} from '../../src/lib/jobcard-logic';
import { repairApi } from '../../src/lib/repair-api';
import type { ChecklistTemplate, FaultCode, JobCardResponse } from '../../src/lib/repair-types';
import { technicianApi } from '../../src/lib/technician-api';
import { dropQueuedJobCardPatch, enqueueWrite, flushWriteQueue } from '../../src/lib/write-queue';

type SyncState = 'idle' | 'local' | 'saving' | 'saved' | 'queued' | 'error';

const SYNC_LABEL: Record<SyncState, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  idle: { label: 'Up to date', tone: 'neutral' },
  local: { label: 'Unsynced draft', tone: 'warning' },
  saving: { label: 'Saving…', tone: 'info' },
  saved: { label: 'Saved', tone: 'success' },
  queued: { label: 'Saved offline — will sync', tone: 'warning' },
  error: { label: 'Save failed', tone: 'danger' },
};

const KIND_ORDER: ChecklistTemplate['kind'][] = ['PRE_SERVICE', 'SAFETY', 'POST_SERVICE'];
const AUTOSAVE_MS = 1500;

interface JobCardQueryData extends JobCardResponse {
  fromCache: boolean;
}

/**
 * Job card: diagnosis, fault codes, checklists (+ readings), parts and
 * remarks. Every edit is written to a local draft immediately and pushed to
 * the server after a short debounce; with no signal the patch goes to the
 * offline write queue (coalesced per booking).
 */
export default function JobCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const booking = useQuery({ queryKey: ['job', id], queryFn: () => technicianApi.booking(id) });

  const jobCardQuery = useQuery<JobCardQueryData | null>({
    queryKey: ['jobcard', id],
    queryFn: async () => {
      try {
        const res = await repairApi.getJobCard(id);
        if (res) await saveJobCardSnapshot(id, res);
        return res ? { ...res, fromCache: false } : null;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        const snap = await loadJobCardSnapshot(id);
        if (snap) return { ...snap, fromCache: true };
        throw err;
      }
    },
    retry: false,
  });

  const [form, setForm] = useState<JobCardForm | null>(null);
  const formRef = useRef<JobCardForm | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [faultPickerOpen, setFaultPickerOpen] = useState(false);
  const [partsPickerOpen, setPartsPickerOpen] = useState(false);
  const [otherPart, setOtherPart] = useState('');
  const [faultDetails, setFaultDetails] = useState<Record<string, FaultCode>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  const data = jobCardQuery.data;
  const templates = useMemo(
    () =>
      [...(data?.templates ?? [])].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [data?.templates],
  );
  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  const serverStatus = data?.jobCard?.status ?? 'DRAFT';
  const readOnly = serverStatus === 'COMPLETED';
  const featureMissing = jobCardQuery.isSuccess && data === null;

  // Hydrate once: prefer an unsynced local draft (or any draft when offline).
  useEffect(() => {
    if (hydrated.current || jobCardQuery.isLoading) return;
    hydrated.current = true;
    void (async () => {
      const draft = await loadJobCardDraft(id);
      const server = jobCardQuery.data;
      const useDraft =
        draft != null &&
        server?.jobCard?.status !== 'COMPLETED' &&
        (!draft.synced || server == null || server.fromCache);
      const initial = useDraft ? draft.form : formFromJobCard(server?.jobCard ?? null);
      formRef.current = initial;
      setForm(initial);
      if (useDraft && !draft.synced) setSync('local');
    })();
  }, [id, jobCardQuery.isLoading, jobCardQuery.data]);

  const pushToServer = useCallback(
    async (snapshot: JobCardForm) => {
      const patch = formToPatch(snapshot, templatesRef.current);
      setSync('saving');
      setSyncError(null);
      try {
        const saved = await repairApi.saveJobCard(id, patch);
        await dropQueuedJobCardPatch(id);
        qc.setQueryData<JobCardQueryData | null>(['jobcard', id], (old) =>
          old ? { ...old, jobCard: saved, fromCache: false } : old,
        );
        await saveJobCardDraft(id, snapshot, true);
        setSync('saved');
      } catch (err) {
        if (isNetworkError(err) || isNotFound(err)) {
          await enqueueWrite({ kind: 'jobcard.patch', bookingId: id, patch });
          await saveJobCardDraft(id, snapshot, true);
          setSync('queued');
        } else {
          setSync('error');
          setSyncError(apiErrorMessage(err));
        }
      }
    },
    [id, qc],
  );

  // Flush a pending autosave when leaving the screen.
  useEffect(
    () => () => {
      if (timer.current && formRef.current) {
        clearTimeout(timer.current);
        void pushToServer(formRef.current);
      }
    },
    [pushToServer],
  );

  const update = (fn: (f: JobCardForm) => JobCardForm) => {
    if (!formRef.current || readOnly) return;
    const next = fn(formRef.current);
    formRef.current = next;
    setForm(next);
    setSync('local');
    void saveJobCardDraft(id, next, false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void pushToServer(next);
    }, AUTOSAVE_MS);
  };

  const missing = useMemo(
    () => (form ? findMissingRequired(templates, form.checklist) : []),
    [form, templates],
  );
  const readings = useMemo(() => (form ? buildReadings(templates, form.checklist) : {}), [form, templates]);
  const readingUnits = useMemo(() => {
    const m: Record<string, { label: string; unit?: string }> = {};
    for (const t of templates) for (const i of t.items) if (i.type === 'number') m[i.key] = { label: i.label, ...(i.unit ? { unit: i.unit } : {}) };
    return m;
  }, [templates]);

  const complete = useMutation({
    mutationFn: async () => {
      const current = formRef.current;
      if (!current) throw new Error('Job card not loaded');
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      await repairApi.saveJobCard(id, formToPatch(current, templatesRef.current));
      await dropQueuedJobCardPatch(id);
      return repairApi.completeJobCard(id, current.firstTimeFix == null ? {} : { firstTimeFix: current.firstTimeFix });
    },
    onSuccess: async (saved) => {
      await clearJobCardDraft(id);
      qc.setQueryData<JobCardQueryData | null>(['jobcard', id], (old) =>
        old ? { ...old, jobCard: saved, fromCache: false } : old,
      );
      setSync('saved');
      void qc.invalidateQueries({ queryKey: ['job', id] });
      Alert.alert('Job card completed', 'Next: get the customer to sign off.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Customer signature', onPress: () => router.push(`/signature/${id}`) },
      ]);
    },
    onError: (err: unknown) => {
      if (isNetworkError(err)) {
        Alert.alert('You are offline', 'Your answers are saved. Completing the job card needs a connection.');
      } else if (apiStatus(err) === 400 && apiErrorCode(err) === 'CHECKLIST_INCOMPLETE') {
        const items = parseMissingItems(apiErrorDetails(err));
        Alert.alert('Checklist incomplete', items.length ? formatMissingItems(items) : apiErrorMessage(err));
      } else if (apiStatus(err) === 400) {
        Alert.alert('Could not complete', apiErrorMessage(err));
      } else {
        Alert.alert('Could not complete', apiErrorMessage(err));
      }
    },
  });

  const onComplete = () => {
    if (!form) return;
    if (missing.length > 0) {
      Alert.alert('Required items missing', formatMissingItems(missing));
      return;
    }
    if (form.firstTimeFix == null) {
      Alert.alert('First-time fix?', 'Mark whether the issue was fixed on this visit.');
      return;
    }
    if (!form.resolution.trim()) {
      Alert.alert('Resolution missing', 'Describe what you did to fix the issue.');
      return;
    }
    complete.mutate();
  };

  if (booking.isLoading || jobCardQuery.isLoading || (!form && !featureMissing && !jobCardQuery.isError)) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  const b = booking.data;
  const category = b?.appliance?.category ?? b?.category ?? null;
  const brand = b?.appliance?.brand ?? b?.applianceBrand ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.subtle, fontSize: 12 }}>{b?.code ?? id}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800' }}>Job card</Text>
            <Text style={{ color: colors.muted }}>
              {[brand, category ? humanizeStatus(category) : null].filter(Boolean).join(' · ') || 'Appliance not linked'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Badge label={humanizeStatus(serverStatus)} tone={readOnly ? 'success' : 'info'} />
            <Badge label={SYNC_LABEL[sync].label} tone={SYNC_LABEL[sync].tone} />
          </View>
        </View>
        {syncError ? <Text style={{ color: colors.danger }}>{syncError}</Text> : null}
        {data?.fromCache ? (
          <Text style={{ color: colors.warning, fontSize: 12 }}>Offline — showing the last downloaded checklist.</Text>
        ) : null}
      </Card>

      {featureMissing ? (
        <View style={{ marginTop: 12 }}>
          <Banner
            tone="info"
            title="Job cards aren't enabled on the server yet"
            body="Your entries are kept on this phone and will sync once the feature is live."
          />
        </View>
      ) : null}
      {jobCardQuery.isError ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Banner tone="danger" title="Couldn't load the job card" body={apiErrorMessage(jobCardQuery.error)} />
          <Button variant="outline" label="Retry" onPress={() => void jobCardQuery.refetch()} />
        </View>
      ) : null}
      {readOnly ? (
        <View style={{ marginTop: 12 }}>
          <Banner tone="success" title="Job card completed" body="It is now read-only." />
        </View>
      ) : null}

      {form ? (
        <>
          <SectionTitle>Symptoms</SectionTitle>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[...new Set([...symptomOptions(category), ...form.symptoms])].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={form.symptoms.includes(s)}
                  onPress={() => update((f) => ({ ...f, symptoms: toggleInList(f.symptoms, s) }))}
                />
              ))}
            </View>
            <Field
              label="Other symptoms / customer complaint"
              multiline
              editable={!readOnly}
              value={form.symptomNotes}
              onChangeText={(t) => update((f) => ({ ...f, symptomNotes: t }))}
              placeholder="e.g. Cooling drops after 2 hours"
            />
          </Card>

          <SectionTitle
            right={
              readOnly ? null : (
                <Button small variant="outline" label="+ Fault code" onPress={() => setFaultPickerOpen(true)} />
              )
            }
          >
            Fault codes
          </SectionTitle>
          <Card>
            {form.faultCodes.length === 0 ? (
              <EmptyNote>No fault codes selected.</EmptyNote>
            ) : (
              form.faultCodes.map((code) => {
                const detail = faultDetails[code];
                return (
                  <View key={code} style={{ gap: 4, paddingVertical: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', flexShrink: 1 }}>
                        {code}
                        {detail ? ` · ${detail.title}` : ''}
                      </Text>
                      {readOnly ? null : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${code}`}
                          onPress={() => update((f) => ({ ...f, faultCodes: f.faultCodes.filter((c) => c !== code) }))}
                          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
                        >
                          <Text style={{ color: colors.danger, fontWeight: '700', padding: 4 }}>Remove</Text>
                        </Pressable>
                      )}
                    </View>
                    {detail?.suggestedFix && !readOnly ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          update((f) => ({
                            ...f,
                            resolution: f.resolution.trim()
                              ? `${f.resolution.trim()}\n${detail.suggestedFix ?? ''}`
                              : (detail.suggestedFix ?? ''),
                          }))
                        }
                      >
                        <Text style={{ color: colors.brand }}>Use suggested fix: {detail.suggestedFix}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>

          <SectionTitle>Diagnosis</SectionTitle>
          <Card style={{ gap: 12 }}>
            <Field
              label="Diagnosis"
              multiline
              editable={!readOnly}
              value={form.diagnosis}
              onChangeText={(t) => update((f) => ({ ...f, diagnosis: t }))}
              placeholder="What you found on inspection"
            />
            <Field
              label="Root cause"
              multiline
              editable={!readOnly}
              value={form.rootCause}
              onChangeText={(t) => update((f) => ({ ...f, rootCause: t }))}
              placeholder="e.g. Gas leak at flare joint"
            />
            <Field
              label="Resolution"
              multiline
              editable={!readOnly}
              value={form.resolution}
              onChangeText={(t) => update((f) => ({ ...f, resolution: t }))}
              placeholder="What you did to fix it"
            />
          </Card>

          {templates.length > 0 ? <SectionTitle>Checklists</SectionTitle> : null}
          <View style={{ gap: 12 }}>
            {templates.map((t) => (
              <ChecklistSection
                key={t.id}
                bookingId={id}
                template={t}
                checklist={form.checklist}
                disabled={readOnly}
                onAnswer={(tpl, key, value) =>
                  update((f) => ({ ...f, checklist: setAnswer(f.checklist, tpl, key, value) }))
                }
              />
            ))}
          </View>

          {Object.keys(readings).length > 0 ? (
            <>
              <SectionTitle>Readings</SectionTitle>
              <Card>
                {Object.entries(readings).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted }}>{readingUnits[k]?.label ?? k}</Text>
                    <Text style={{ fontWeight: '700' }}>
                      {v} {readingUnits[k]?.unit ?? ''}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionTitle
            right={
              readOnly ? null : (
                <Button small variant="outline" label="+ From van" onPress={() => setPartsPickerOpen(true)} />
              )
            }
          >
            Parts recommended
          </SectionTitle>
          <Card>
            {form.partsRecommended.length === 0 ? <EmptyNote>No parts recommended.</EmptyNote> : null}
            {form.partsRecommended.map((p, idx) => (
              <View
                key={`${p.itemId ?? p.name}-${idx}`}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontWeight: '600' }}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {p.inVan ? 'In van' : 'Needs ordering'}
                    {p.sku ? ` · ${p.sku}` : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {readOnly ? null : (
                    <Button
                      small
                      variant="outline"
                      label="−"
                      onPress={() =>
                        update((f) => ({
                          ...f,
                          partsRecommended:
                            p.quantity <= 1
                              ? f.partsRecommended.filter((_, i) => i !== idx)
                              : f.partsRecommended.map((x, i) => (i === idx ? { ...x, quantity: x.quantity - 1 } : x)),
                        }))
                      }
                    />
                  )}
                  <Text style={{ fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{p.quantity}</Text>
                  {readOnly ? null : (
                    <Button
                      small
                      variant="outline"
                      label="+"
                      onPress={() =>
                        update((f) => ({
                          ...f,
                          partsRecommended: f.partsRecommended.map((x, i) =>
                            i === idx ? { ...x, quantity: x.quantity + 1 } : x,
                          ),
                        }))
                      }
                    />
                  )}
                </View>
              </View>
            ))}
            {readOnly ? null : (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={otherPart}
                  onChangeText={setOtherPart}
                  placeholder="Other part (not in van)"
                  accessibilityLabel="Other part (not in van)"
                  placeholderTextColor={colors.subtle}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                />
                <Button
                  small
                  label="Add"
                  disabled={!otherPart.trim()}
                  onPress={() => {
                    const name = otherPart.trim();
                    update((f) => ({
                      ...f,
                      partsRecommended: [...f.partsRecommended, { name, quantity: 1, inVan: false }],
                    }));
                    setOtherPart('');
                  }}
                />
              </View>
            )}
          </Card>

          <SectionTitle>Remarks</SectionTitle>
          <Card>
            <Field
              label="Technician remarks"
              multiline
              editable={!readOnly}
              value={form.technicianRemarks}
              onChangeText={(t) => update((f) => ({ ...f, technicianRemarks: t }))}
              placeholder="Advice given, follow-ups, anything the next technician should know"
            />
          </Card>

          <SectionTitle>Complete</SectionTitle>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', flexShrink: 1 }}>First-time fix?</Text>
              <View pointerEvents={readOnly ? 'none' : 'auto'}>
                <YesNo
                  value={form.firstTimeFix ?? undefined}
                  onChange={(v) => update((f) => ({ ...f, firstTimeFix: v ?? null }))}
                />
              </View>
            </View>
            {missing.length > 0 ? (
              <Text style={{ color: colors.warning }}>
                {missing.length} required checklist item{missing.length === 1 ? '' : 's'} left
              </Text>
            ) : null}
            {readOnly ? (
              <Button label="Customer signature" onPress={() => router.push(`/signature/${id}`)} />
            ) : (
              <Button
                label="Complete job card"
                loading={complete.isPending}
                disabled={featureMissing}
                onPress={onComplete}
              />
            )}
            {sync === 'queued' || sync === 'error' ? (
              <Button small variant="outline" label="Retry sync now" onPress={() => void flushWriteQueue()} />
            ) : null}
          </Card>
        </>
      ) : null}

      <FaultCodePicker
        visible={faultPickerOpen}
        category={category}
        brand={brand}
        selected={form?.faultCodes ?? []}
        onClose={() => setFaultPickerOpen(false)}
        onToggle={(fc) => {
          setFaultDetails((d) => ({ ...d, [fc.code]: fc }));
          update((f) => ({ ...f, faultCodes: toggleInList(f.faultCodes, fc.code) }));
        }}
      />
      <VanPartsPicker
        visible={partsPickerOpen}
        onClose={() => setPartsPickerOpen(false)}
        onPick={(row) => {
          setPartsPickerOpen(false);
          update((f) => {
            const idx = f.partsRecommended.findIndex((p) => p.itemId === row.item.id);
            if (idx >= 0) {
              return {
                ...f,
                partsRecommended: f.partsRecommended.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + 1 } : p)),
              };
            }
            return {
              ...f,
              partsRecommended: [
                ...f.partsRecommended,
                { itemId: row.item.id, sku: row.item.sku, name: row.item.name, quantity: 1, inVan: true },
              ],
            };
          });
        }}
      />
    </ScrollView>
  );
}
