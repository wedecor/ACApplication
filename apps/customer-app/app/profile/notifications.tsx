import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import {
  registerForPushNotifications,
  unregisterPushToken,
} from '@/lib/push';
import { secureStore, SecureKeys } from '@/lib/secure-store';
import { colors, spacing } from '@/theme/tokens';

export default function NotificationsSettingsScreen() {
  const [push, setPush] = useState<boolean>(false);
  const [promo, setPromo] = useState<boolean>(true);
  const [whatsapp, setWhatsapp] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const token = await secureStore.getItem(SecureKeys.PushToken);
      setPush(!!token);
    })();
  }, []);

  async function togglePush(next: boolean) {
    setPush(next);
    if (next) {
      await registerForPushNotifications();
    } else {
      await unregisterPushToken();
    }
  }

  return (
    <Screen padded>
      <SubHeader title="Notifications" />
      <Card padded={false} style={{ marginTop: spacing[4] }}>
        <Row
          title="Push notifications"
          subtitle="Booking, payment, and AMC updates"
          value={push}
          onChange={togglePush}
        />
        <Divider />
        <Row
          title="WhatsApp notifications"
          subtitle="Fallback for important updates"
          value={whatsapp}
          onChange={setWhatsapp}
        />
        <Divider />
        <Row
          title="Offers & promos"
          subtitle="Seasonal AMC discounts, partner coupons"
          value={promo}
          onChange={setPromo}
        />
      </Card>
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center', marginTop: spacing[4] }}>
        Critical security alerts are always sent regardless of these settings.
      </Text>
    </Screen>
  );
}

function Row({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing[4],
        gap: spacing[3],
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        <Text variant="caption" tone="muted">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.border }}
      />
    </View>
  );
}
