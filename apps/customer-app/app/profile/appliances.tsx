import { useRouter } from 'expo-router';
import { ImagePlus, Plus, Refrigerator, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';

import type { CustomerAppliance, CustomerApplianceInput } from '@/api/types';
import { SubHeader } from '@/components/layout/sub-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { APPLIANCE_CATEGORY_OPTIONS, getApplianceByCategory } from '@/content/appliances';
import { useAppliances, useRemoveAppliance, useSaveAppliance } from '@/hooks/use-appliances';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { pickAndUploadImage } from '@/lib/upload';
import { computeWarrantyStatus, warrantyLabel, warrantyTone } from '@/lib/warranty';
import { colors, radius, spacing } from '@/theme/tokens';

interface FormState {
  category: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  capacity: string;
  installedLocation: string;
  purchaseDate: string;
  installDate: string;
  manufacturerWarrantyUntil: string;
  photos: string[];
}

const EMPTY: FormState = {
  category: 'AC_REPAIR',
  brand: '',
  modelNumber: '',
  serialNumber: '',
  capacity: '',
  installedLocation: '',
  purchaseDate: '',
  installDate: '',
  manufacturerWarrantyUntil: '',
  photos: [],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toForm(a: CustomerAppliance): FormState {
  return {
    category: a.category,
    brand: a.brand,
    modelNumber: a.modelNumber ?? '',
    serialNumber: a.serialNumber ?? '',
    capacity: a.capacity ?? '',
    installedLocation: a.installedLocation ?? '',
    purchaseDate: a.purchaseDate?.slice(0, 10) ?? '',
    installDate: a.installDate?.slice(0, 10) ?? '',
    manufacturerWarrantyUntil: a.manufacturerWarrantyUntil?.slice(0, 10) ?? '',
    photos: a.photos,
  };
}

function dateOrNull(v: string): string | null {
  return v ? new Date(`${v}T00:00:00Z`).toISOString() : null;
}

function toInput(f: FormState): CustomerApplianceInput {
  return {
    category: f.category,
    brand: f.brand.trim(),
    modelNumber: f.modelNumber.trim() || null,
    serialNumber: f.serialNumber.trim() || null,
    capacity: f.capacity.trim() || null,
    installedLocation: f.installedLocation.trim() || null,
    purchaseDate: dateOrNull(f.purchaseDate),
    installDate: dateOrNull(f.installDate),
    manufacturerWarrantyUntil: dateOrNull(f.manufacturerWarrantyUntil),
    photos: f.photos,
  };
}

export default function AppliancesScreen() {
  const router = useRouter();
  const list = useAppliances();
  const save = useSaveAppliance();
  const remove = useRemoveAppliance();
  const [editing, setEditing] = useState<{ id?: string; form: FormState } | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = editing?.form;
  const setForm = (patch: Partial<FormState>) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const badDate = form
    ? [form.purchaseDate, form.installDate, form.manufacturerWarrantyUntil].some((d) => d && !DATE_RE.test(d))
    : false;
  const preview = form ? computeWarrantyStatus([dateOrNull(form.manufacturerWarrantyUntil)]) : null;

  async function addPhoto() {
    if (!form || uploading) return;
    setUploading(true);
    try {
      const picked = await pickAndUploadImage('library');
      if (picked) setForm({ photos: [...form.photos, picked.publicUrl] });
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!editing) return;
    try {
      await save.mutateAsync({ id: editing.id, body: toInput(editing.form) });
      setEditing(null);
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }

  function confirmRemove(a: CustomerAppliance) {
    Alert.alert('Remove appliance?', `${a.brand} ${a.categoryLabel} will be removed from your list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(a.id, {
            onError: (err) =>
              Alert.alert('Failed', err instanceof ApiError ? err.message : 'Please try again.'),
          }),
      },
    ]);
  }

  return (
    <Screen padded>
      <SubHeader
        title="My appliances"
        trailing={
          <Pressable onPress={() => setEditing({ form: { ...EMPTY } })} hitSlop={12} accessibilityLabel="Add appliance">
            <Plus size={22} color={colors.brand} />
          </Pressable>
        }
      />
      <Text variant="body" tone="muted" style={{ marginTop: spacing[2] }}>
        Register your appliances to track warranty, service history and book faster.
      </Text>

      <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
        {list.isLoading ? (
          <Card>
            <Skeleton width="50%" />
            <Skeleton width="80%" style={{ marginTop: 8 }} />
          </Card>
        ) : !list.data?.length ? (
          <EmptyState
            title="No appliances yet"
            subtitle="Add your AC, fridge, washing machine and more."
            icon={<Refrigerator size={26} />}
            action={<Button label="Add appliance" onPress={() => setEditing({ form: { ...EMPTY } })} />}
          />
        ) : (
          list.data.map((a) => {
            const emoji = getApplianceByCategory(a.category)?.emoji ?? '\u{1F527}';
            return (
              <Pressable key={a.id} onPress={() => setEditing({ id: a.id, form: toForm(a) })}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                    <Text variant="h2">{emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="h3">
                        {a.brand} {a.categoryLabel}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {[a.modelNumber, a.capacity, a.installedLocation].filter(Boolean).join(' • ') ||
                          'Tap to add details'}
                      </Text>
                    </View>
                    <Pressable onPress={() => confirmRemove(a)} hitSlop={12} accessibilityLabel="Remove appliance">
                      <Trash2 size={18} color={colors.inkMuted} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] }}>
                    <Badge
                      small
                      tone={warrantyTone(a.warranty.status)}
                      label={warrantyLabel(a.warranty.status, a.warranty.daysLeft)}
                    />
                    {a.warranty.until ? (
                      <Text variant="caption" tone="muted">
                        until {formatDate(a.warranty.until)}
                      </Text>
                    ) : null}
                  </View>
                  <Button
                    label="Book a service"
                    variant="outline"
                    style={{ marginTop: spacing[3] }}
                    onPress={() => {
                      const catalogue = getApplianceByCategory(a.category);
                      router.push(catalogue ? `/book?appliance=${catalogue.id}&registered=${a.id}` : '/book');
                    }}
                  />
                </Card>
              </Pressable>
            );
          })
        )}
      </View>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit appliance' : 'Add appliance'}
      >
        {form ? (
          <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: spacing[3] }}>
              <Text variant="caption" tone="muted">
                Type
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {APPLIANCE_CATEGORY_OPTIONS.map((o) => {
                  const active = form.category === o.category;
                  return (
                    <Pressable
                      key={o.category}
                      onPress={() => setForm({ category: o.category })}
                      accessibilityState={{ selected: active }}
                      style={{
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radius.lg,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brand50 : colors.surface,
                      }}
                    >
                      <Text variant="caption" tone={active ? 'brand' : 'default'}>
                        {o.emoji} {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input label="Brand" value={form.brand} onChangeText={(v) => setForm({ brand: v })} placeholder="e.g. Daikin" />
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <View style={{ flex: 1 }}>
                  <Input label="Model no." value={form.modelNumber} onChangeText={(v) => setForm({ modelNumber: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Serial no." value={form.serialNumber} onChangeText={(v) => setForm({ serialNumber: v })} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <View style={{ flex: 1 }}>
                  <Input label="Capacity" value={form.capacity} onChangeText={(v) => setForm({ capacity: v })} placeholder="1.5 ton" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Location"
                    value={form.installedLocation}
                    onChangeText={(v) => setForm({ installedLocation: v })}
                    placeholder="Bedroom"
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Purchased"
                    value={form.purchaseDate}
                    onChangeText={(v) => setForm({ purchaseDate: v })}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Installed"
                    value={form.installDate}
                    onChangeText={(v) => setForm({ installDate: v })}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              <Input
                label="Manufacturer warranty until"
                value={form.manufacturerWarrantyUntil}
                onChangeText={(v) => setForm({ manufacturerWarrantyUntil: v })}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                error={badDate ? 'Use the YYYY-MM-DD format' : undefined}
              />
              {preview && !badDate ? (
                <View style={{ alignSelf: 'flex-start' }}>
                  <Badge tone={warrantyTone(preview.status)} label={warrantyLabel(preview.status, preview.daysLeft)} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {form.photos.map((url) => (
                  <View key={url} style={{ width: 72, height: 72 }}>
                    <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: radius.lg }} />
                    <Pressable
                      onPress={() => setForm({ photos: form.photos.filter((p) => p !== url) })}
                      accessibilityLabel="Remove photo"
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: colors.ink,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {form.photos.length < 6 ? (
                  <Button
                    label="Photo"
                    variant="outline"
                    loading={uploading}
                    leftIcon={<ImagePlus size={16} color={colors.ink} />}
                    onPress={addPhoto}
                  />
                ) : null}
              </View>
              <Button
                label={editing?.id ? 'Save changes' : 'Add appliance'}
                fullWidth
                size="lg"
                loading={save.isPending}
                disabled={!form.brand.trim() || badDate}
                onPress={submit}
              />
            </View>
          </ScrollView>
        ) : null}
      </Sheet>
    </Screen>
  );
}
