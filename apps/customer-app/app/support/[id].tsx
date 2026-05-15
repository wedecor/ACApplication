import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import {
  useSendSupportMessage,
  useSupportMessages,
  useSupportTicket,
} from '@/hooks/use-support';
import { formatRelative } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';
import type { SupportMessage } from '@/api/types';

/**
 * In-app support chat screen.
 *
 * Polling-based realtime (8-second tick) so it works offline-tolerantly.
 * The websocket gateway is still used in the background and will trigger
 * an extra invalidate via the realtime event listener — that's why the
 * polling interval can stay conservative.
 */
export default function TicketChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useSupportTicket(id);
  const messages = useSupportMessages(id);
  const send = useSendSupportMessage(id);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<SupportMessage>>(null);

  useEffect(() => {
    if (messages.data?.length) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }, [messages.data?.length]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft('');
    try {
      await send.mutateAsync(text);
    } catch {
      setDraft(text);
    }
  }, [draft, send]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {ticket.data?.subject ?? 'Support chat'}
          </Text>
          <Text variant="micro" tone="muted">
            {ticket.data?.number ?? ''}
          </Text>
        </View>
        {ticket.data?.status ? (
          <Badge
            tone={
              ticket.data.status === 'RESOLVED' || ticket.data.status === 'CLOSED'
                ? 'success'
                : ticket.data.status === 'WAITING_CUSTOMER' ||
                    ticket.data.status === 'AWAITING_CUSTOMER'
                  ? 'warn'
                  : 'brand'
            }
            label={ticket.data.status.replace(/_/g, ' ').toLowerCase()}
            small
          />
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}
          renderItem={({ item }) => <Bubble message={item} />}
          ListEmptyComponent={
            messages.isLoading ? (
              <View style={{ paddingVertical: spacing[8], alignItems: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <Text tone="muted" style={{ textAlign: 'center', marginTop: spacing[8] }}>
                Send a message to start the conversation.
              </Text>
            )
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your message..."
            placeholderTextColor={colors.inkSubtle}
            style={styles.input}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendBtn,
              !draft.trim() && { opacity: 0.5 },
              pressed && { opacity: 0.7 },
            ]}
            disabled={!draft.trim() || send.isPending}
            accessibilityLabel="Send message"
          >
            {send.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Send size={18} color={colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: SupportMessage }) {
  const isCustomer = message.authorKind === 'CUSTOMER';
  return (
    <View
      style={[
        styles.bubble,
        isCustomer ? styles.bubbleOut : styles.bubbleIn,
      ]}
    >
      <Text
        variant="body"
        tone={isCustomer ? 'inverse' : 'default'}
        style={{ flexShrink: 1 }}
      >
        {message.body}
      </Text>
      <Text
        variant="micro"
        tone={isCustomer ? 'inverse' : 'subtle'}
        style={{ marginTop: 4, opacity: 0.8 }}
      >
        {formatRelative(message.createdAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
