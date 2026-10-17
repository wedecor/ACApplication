import * as Clipboard from 'expo-clipboard';
import { Copy, Gift, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import type { ReferralStatus } from '@/api/types';
import { SubHeader } from '@/components/layout/sub-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useApplyReferral, useReferrals } from '@/hooks/use-growth';
import { ApiError } from '@/lib/api-client';
import { formatDate, formatRupees } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

const STATUS_TONE: Record<ReferralStatus, 'neutral' | 'brand' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  QUALIFIED: 'brand',
  REWARDED: 'success',
  REJECTED: 'danger',
};

export default function ReferralsScreen() {
  const referrals = useReferrals();
  const apply = useApplyReferral();
  const [friendCode, setFriendCode] = useState('');
  const data = referrals.data;

  async function onApply() {
    try {
      await apply.mutateAsync(friendCode);
      setFriendCode('');
      Alert.alert('Code applied', 'Your discount will be applied to your first booking.');
    } catch (err) {
      Alert.alert('Could not apply code', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }

  return (
    <Screen padded>
      <SubHeader title="Refer & earn" />
      <Card style={{ marginTop: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#fef3c7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Gift color={colors.warn} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h2">Invite friends, earn credit</Text>
            <Text variant="caption" tone="muted">
              Friends get a discount on their first booking; you earn credit when they complete it.
            </Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: spacing[3] }}>
        <Text variant="caption" tone="muted">
          Your code
        </Text>
        {referrals.isLoading ? (
          <Skeleton width="50%" height={32} style={{ marginTop: 6 }} />
        ) : data ? (
          <>
            <Text variant="display" style={{ letterSpacing: 2 }}>
              {data.code}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
              <Button
                label="Copy link"
                variant="secondary"
                leftIcon={<Copy size={16} color={colors.brand} />}
                onPress={async () => {
                  await Clipboard.setStringAsync(data.shareUrl);
                  Alert.alert('Copied', 'Referral link copied to clipboard.');
                }}
              />
              <Button
                label="Share"
                variant="primary"
                leftIcon={<Share2 size={16} color="#fff" />}
                onPress={() =>
                  Share.share({
                    message: `Use my code ${data.code} for a discount on your first AC Platform booking. ${data.shareUrl}`,
                  })
                }
              />
            </View>
          </>
        ) : (
          <View style={{ marginTop: spacing[2] }}>
            <Text variant="caption" tone="muted">
              Couldn’t load your referral code.
            </Text>
            <Button label="Retry" variant="outline" onPress={() => referrals.refetch()} style={{ marginTop: spacing[2] }} />
          </View>
        )}
      </Card>

      {data ? (
        <Card style={{ marginTop: spacing[3] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Stat label="Invited" value={String(data.referredCount)} />
            <Stat label="Rewarded" value={String(data.rewardedCount)} />
            <Stat label="Earned" value={formatRupees(data.totalRewardMinor)} />
          </View>
        </Card>
      ) : null}

      {data?.referrals.length ? (
        <Card style={{ marginTop: spacing[3] }}>
          <Text variant="h3">Your referrals</Text>
          {data.referrals.map((r, idx) => (
            <View key={r.id}>
              {idx > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing[2],
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body">{r.referredName}</Text>
                  <Text variant="caption" tone="muted">
                    {formatDate(r.createdAt)}
                    {r.rewardMinor ? ` • ${formatRupees(r.rewardMinor)}` : ''}
                  </Text>
                </View>
                <Badge small tone={STATUS_TONE[r.status]} label={r.status.toLowerCase()} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing[3] }}>
        <Text variant="h3">Have a friend’s code?</Text>
        <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'flex-end', marginTop: spacing[2] }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Enter code"
              autoCapitalize="characters"
              value={friendCode}
              onChangeText={setFriendCode}
            />
          </View>
          <Button
            label="Apply"
            variant="outline"
            loading={apply.isPending}
            disabled={friendCode.trim().length < 3}
            onPress={onApply}
          />
        </View>
      </Card>

      <View style={{ marginTop: spacing[4] }}>
        <Text variant="h3">How it works</Text>
        <View style={{ marginTop: spacing[2], gap: 6 }}>
          {[
            'Share your code with a friend.',
            'They book their first service with your code.',
            'You earn credit when the booking is completed.',
          ].map((line, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Text variant="caption" tone="brand" weight="700">
                {idx + 1}.
              </Text>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text variant="h2">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
