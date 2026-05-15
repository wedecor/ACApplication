import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAmcPlans, useMyAmc, useRenewAmc } from '@/hooks/use-amc';
import { track, Events } from '@/lib/analytics';
import { formatDate, formatRupees } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

import type { AmcSubscription } from '@/api/types';

export default function AmcScreen() {
  const plans = useAmcPlans();
  const mine = useMyAmc();
  const renew = useRenewAmc();
  const router = useRouter();
  const refreshing = plans.isFetching || mine.isFetching;

  useEffect(() => {
    track(Events.AmcView);
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            plans.refetch();
            mine.refetch();
          }}
        />
      }
    >
      <Text variant="h1">AC+ Membership</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Skip surge pricing, get priority dispatch and free preventive service all year.
      </Text>

      {(mine.data?.length ?? 0) > 0 ? (
        <>
          <Text variant="h2" style={{ marginTop: spacing[6] }}>
            Your plans
          </Text>
          <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
            {(mine.data ?? []).map((sub) => (
              <ActiveSubscriptionCard
                key={sub.id}
                subscription={sub}
                onRenew={() => renew.mutate(sub.id)}
                renewing={renew.isPending && renew.variables === sub.id}
              />
            ))}
          </View>
        </>
      ) : null}

      <Text variant="h2" style={{ marginTop: spacing[6] }}>
        Choose a plan
      </Text>
      <View style={{ marginTop: spacing[3] }}>
        {plans.isLoading ? (
          <Card>
            <Skeleton width="40%" />
            <Skeleton width="80%" style={{ marginTop: 8 }} />
            <Skeleton width="60%" style={{ marginTop: 8 }} />
          </Card>
        ) : (
          <FlatList
            data={plans.data ?? []}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: spacing[3] }}
            renderItem={({ item }) => (
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <ShieldCheck color={colors.brand} size={20} />
                    <Text variant="h2">{item.name}</Text>
                  </View>
                  {item.popular ? <Badge tone="brand" label="Most popular" /> : null}
                </View>
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {item.tagline}
                </Text>
                <Divider />
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text variant="display">{formatRupees(item.priceMinor)}</Text>
                  <Text variant="caption" tone="muted">
                    {' '}/ {item.durationMonths} months
                  </Text>
                </View>
                <Text variant="caption" tone="muted">
                  {item.visitsIncluded} visits included \u2022 {item.emergencyIncluded ? 'emergency covered' : 'emergency extra'}
                </Text>
                <View style={{ marginTop: spacing[3], gap: 6 }}>
                  {item.features.map((f) => (
                    <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
                      <CheckCircle2 size={14} color={colors.accent} style={{ marginTop: 2 }} />
                      <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                        {f}
                      </Text>
                    </View>
                  ))}
                </View>
                <Button
                  label={`Get ${item.name}`}
                  fullWidth
                  leftIcon={<Sparkles size={16} color="#fff" />}
                  onPress={() => router.push(`/amc/${item.id}`)}
                  style={{ marginTop: spacing[3] }}
                />
              </Card>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

function ActiveSubscriptionCard({
  subscription,
  onRenew,
  renewing,
}: {
  subscription: AmcSubscription;
  onRenew: () => void;
  renewing: boolean;
}) {
  const expiringSoon = subscription.status === 'EXPIRING';
  const tone = subscription.status === 'EXPIRED' ? 'danger' : expiringSoon ? 'warn' : 'success';
  return (
    <LinearGradient
      colors={['#0945a8', '#062b65']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.xl, padding: spacing[5] }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text tone="inverse" variant="h3">
          {subscription.planName}
        </Text>
        <Badge label={subscription.status.toLowerCase()} tone={tone} small />
      </View>
      <Text tone="inverse" variant="caption" style={{ opacity: 0.8, marginTop: 4 }}>
        Active until {formatDate(subscription.expiresAt)}
      </Text>
      <Text tone="inverse" variant="display" style={{ marginTop: spacing[3] }}>
        {subscription.visitsRemaining}
        <Text tone="inverse" variant="body" style={{ opacity: 0.7 }}>
          {' '}/ {subscription.visitsTotal} visits left
        </Text>
      </Text>
      <View
        style={{
          height: 6,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.2)',
          marginTop: spacing[3],
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 6,
            borderRadius: 999,
            width: `${Math.max(0, Math.min(1, subscription.visitsRemaining / Math.max(1, subscription.visitsTotal))) * 100}%`,
            backgroundColor: '#fff',
          }}
        />
      </View>
      {expiringSoon ? (
        <Button
          label="Renew now"
          fullWidth
          variant="accent"
          loading={renewing}
          onPress={onRenew}
          style={{ marginTop: spacing[3] }}
        />
      ) : null}
    </LinearGradient>
  );
}
