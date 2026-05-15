import * as Application from 'expo-application';
import { Linking, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import { spacing } from '@/theme/tokens';

export default function AboutScreen() {
  return (
    <Screen padded>
      <SubHeader title="About" />
      <View style={{ marginTop: spacing[4], alignItems: 'center' }}>
        <Text variant="display">AC Platform</Text>
        <Text variant="caption" tone="muted">
          v{Application.nativeApplicationVersion ?? '0.1.0'}
        </Text>
      </View>
      <Card padded={false} style={{ marginTop: spacing[6] }}>
        <ListRow
          title="Privacy policy"
          onPress={() => Linking.openURL('https://acplatform.in/privacy')}
        />
        <Divider />
        <ListRow
          title="Terms of service"
          onPress={() => Linking.openURL('https://acplatform.in/terms')}
        />
        <Divider />
        <ListRow
          title="Refund & cancellation"
          onPress={() => Linking.openURL('https://acplatform.in/refunds')}
        />
      </Card>
    </Screen>
  );
}
