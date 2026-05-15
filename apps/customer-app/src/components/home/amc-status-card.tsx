import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, ShieldCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/format';
import { radius, spacing } from '@/theme/tokens';

import type { AmcSubscription } from '@/api/types';

interface Props {
  subscription?: AmcSubscription | null;
}

export function AmcStatusCard({ subscription }: Props) {
  const router = useRouter();
  if (!subscription) {
    return (
      <Pressable onPress={() => router.push('/(tabs)/amc')}>
        <LinearGradient
          colors={['#0f59db', '#062b65']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing[5] }}
        >
          <ShieldCheck color="#fff" size={24} />
          <Text tone="inverse" variant="h2" style={{ marginTop: spacing[3] }}>
            Join AC+ Membership
          </Text>
          <Text tone="inverse" variant="caption" style={{ opacity: 0.85, marginTop: 4 }}>
            Unlimited tune-ups, priority support, and 24x7 emergency response.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[4] }}>
            <Text tone="inverse" variant="caption" weight="600">
              Explore plans
            </Text>
            <ChevronRight color="#fff" size={16} />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }
  const remainingPct = Math.max(
    0,
    Math.min(1, subscription.visitsRemaining / Math.max(1, subscription.visitsTotal)),
  );
  return (
    <Pressable onPress={() => router.push('/(tabs)/amc')}>
      <LinearGradient
        colors={['#0f59db', '#073780']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.xl, padding: spacing[5] }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
            }}
          >
            <ShieldCheck color="#fff" size={18} />
            <Text tone="inverse" variant="caption" weight="700">
              {subscription.planName}
            </Text>
          </View>
          <Text tone="inverse" variant="caption" style={{ opacity: 0.85 }}>
            Expires {formatDate(subscription.expiresAt)}
          </Text>
        </View>
        <Text tone="inverse" variant="display" style={{ marginTop: spacing[3] }}>
          {subscription.visitsRemaining}
          <Text tone="inverse" variant="body" style={{ opacity: 0.7 }}>
            {' '}/ {subscription.visitsTotal} visits
          </Text>
        </Text>
        <View
          style={{
            marginTop: spacing[3],
            height: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.2)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 999,
              width: `${remainingPct * 100}%`,
              backgroundColor: '#fff',
            }}
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}
