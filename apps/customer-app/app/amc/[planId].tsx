import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAddresses } from '@/hooks/use-addresses';
import { useAmcPlans, usePurchaseAmc } from '@/hooks/use-amc';
import { APPLIANCES } from '@/content/appliances';
import { ApiError } from '@/lib/api-client';
import { formatRupees } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const plans = useAmcPlans();
  const addresses = useAddresses();
  const purchase = usePurchaseAmc();
  const plan = useMemo(() => plans.data?.find((p) => p.id === planId), [plans.data, planId]);
  const defaultAddress = (addresses.data ?? []).find((a) => a.isDefault) ?? addresses.data?.[0];
  const [selected, setSelected] = useState<string[]>([]);

  if (!plan) return null;

  function toggle(applianceId: string) {
    setSelected((prev) =>
      prev.includes(applianceId) ? prev.filter((p) => p !== applianceId) : [...prev, applianceId],
    );
  }

  async function onPurchase() {
    if (!defaultAddress) {
      Alert.alert('Add an address', 'Please add a service address before subscribing.');
      router.push('/profile/addresses');
      return;
    }
    try {
      const result = await purchase.mutateAsync({
        planId: plan!.id,
        appliances: selected,
        addressId: defaultAddress.id,
      });
      router.replace(`/invoice/${result.invoiceId}`);
    } catch (err) {
      Alert.alert(
        'Could not purchase',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    }
  }

  return (
    <Screen padded>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Text variant="h2">{plan.name}</Text>
      </View>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        {plan.tagline}
      </Text>
      <Card style={{ marginTop: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <ShieldCheck color={colors.brand} size={20} />
          <Text variant="h3">What\u2019s included</Text>
        </View>
        <View style={{ marginTop: spacing[2], gap: 6 }}>
          {plan.features.map((f) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
              <CheckCircle2 size={14} color={colors.accent} style={{ marginTop: 2 }} />
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {f}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Text variant="h3" style={{ marginTop: spacing[4] }}>
        Pick appliances to cover
      </Text>
      <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
        {APPLIANCES.map((a) => {
          const active = selected.includes(a.id);
          return (
            <Pressable key={a.id} onPress={() => toggle(a.id)}>
              <Card
                padded={false}
                elevated={false}
                style={{
                  padding: spacing[4],
                  borderColor: active ? colors.brand : colors.border,
                  borderWidth: active ? 2 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text variant="h2">{a.emoji}</Text>
                <Text variant="h3" style={{ marginLeft: spacing[3], flex: 1 }}>
                  {a.name}
                </Text>
                {active ? <Badge tone="brand" label="Selected" small /> : null}
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ marginTop: spacing[4] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="muted">
            Plan price
          </Text>
          <Text variant="h3">{formatRupees(plan.priceMinor)}</Text>
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="h3">Pay today</Text>
          <Text variant="h3">{formatRupees(plan.priceMinor)}</Text>
        </View>
      </Card>

      <Button
        label="Activate membership"
        fullWidth
        size="lg"
        loading={purchase.isPending}
        disabled={selected.length === 0}
        onPress={onPurchase}
        style={{ marginTop: spacing[4] }}
      />
    </Screen>
  );
}
