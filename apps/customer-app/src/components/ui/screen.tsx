import { type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  refreshControl?: ScrollViewProps['refreshControl'];
  testID?: string;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'bottom'],
  contentContainerStyle,
  refreshControl,
  testID,
}: Props) {
  const inner = padded ? (
    <View style={styles.padded}>{children}</View>
  ) : (
    children
  );
  return (
    <SafeAreaView style={styles.root} edges={[...edges]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { paddingBottom: spacing[12] },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          testID={testID}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }} testID={testID}>
          {inner}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
});
