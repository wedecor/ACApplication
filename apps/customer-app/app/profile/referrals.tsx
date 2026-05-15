import * as Clipboard from 'expo-clipboard';
import { Copy, Gift, Share2 } from 'lucide-react-native';
import { Alert, Share, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import { useAuthStore } from '@/state/auth-store';
import { colors, spacing } from '@/theme/tokens';

export default function ReferralsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const code = (profile?.phone ?? '0000').slice(-4).toUpperCase() + 'AC';
  const link = `https://acplatform.in/r/${code}`;

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
            <Text variant="h2">Earn \u20B9300</Text>
            <Text variant="caption" tone="muted">
              Friends get \u20B9300 off their first booking; you get \u20B9300 credit when they
              complete it.
            </Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: spacing[3] }}>
        <Text variant="caption" tone="muted">
          Your code
        </Text>
        <Text variant="display" style={{ letterSpacing: 2 }}>
          {code}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
          <Button
            label="Copy link"
            variant="secondary"
            leftIcon={<Copy size={16} color={colors.brand} />}
            onPress={async () => {
              await Clipboard.setStringAsync(link);
              Alert.alert('Copied', 'Referral link copied to clipboard.');
            }}
          />
          <Button
            label="Share"
            variant="primary"
            leftIcon={<Share2 size={16} color="#fff" />}
            onPress={() =>
              Share.share({
                message: `Use my code ${code} to get \u20B9300 off your first AC Platform booking. ${link}`,
              })
            }
          />
        </View>
      </Card>

      <View style={{ marginTop: spacing[4] }}>
        <Text variant="h3">How it works</Text>
        <View style={{ marginTop: spacing[2], gap: 6 }}>
          {[
            'Share your code with a friend.',
            'They book their first service with your code.',
            'You earn \u20B9300 credit when the booking is completed.',
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
