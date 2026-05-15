import { X } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: Props) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            padding: spacing[5],
            paddingBottom: spacing[10],
            maxHeight: '85%',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing[3] }}>
            <View
              style={{
                width: 40,
                height: 5,
                borderRadius: 999,
                backgroundColor: colors.border,
              }}
            />
          </View>
          {title ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <Text variant="h2">{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <X size={22} color={colors.inkMuted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
