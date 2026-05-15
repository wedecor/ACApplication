import { Inbox } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { Text } from './text';

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, subtitle, icon, action }: Props) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing[8] }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.brand50,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[4],
        }}
      >
        {icon ?? <Inbox color={colors.brand} size={28} />}
      </View>
      <Text variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" tone="muted" style={{ textAlign: 'center', marginTop: 6, maxWidth: 320 }}>
          {subtitle}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing[4] }}>{action}</View> : null}
    </View>
  );
}
