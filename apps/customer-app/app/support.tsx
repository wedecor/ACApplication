import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  HeadphonesIcon,
  MessageCircle,
  PhoneCall,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  useCreateSupportTicket,
  useFaqs,
  useSupportTickets,
} from '@/hooks/use-support';
import { track, Events } from '@/lib/analytics';
import { dialPhone, openWhatsApp } from '@/lib/external';
import { formatRelative } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

export default function SupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const tickets = useSupportTickets();
  const faqs = useFaqs();
  const create = useCreateSupportTicket();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '' });
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Screen padded>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Text variant="h2">Help & support</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            track(Events.SupportWhatsApp, { source: params.bookingId ? 'booking' : 'support' });
            void openWhatsApp(
              params.bookingId
                ? `Hi, I need help with booking ${params.bookingId}.`
                : 'Hi, I need help with a recent booking.',
            );
          }}
        >
          <Card style={{ alignItems: 'center', paddingVertical: spacing[4] }}>
            <MessageCircle color={colors.accent} size={22} />
            <Text variant="h3" style={{ marginTop: spacing[2] }}>
              WhatsApp
            </Text>
            <Text variant="caption" tone="muted">
              Avg 5 min reply
            </Text>
          </Card>
        </Pressable>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            track(Events.SupportCall);
            void dialPhone();
          }}
        >
          <Card style={{ alignItems: 'center', paddingVertical: spacing[4] }}>
            <PhoneCall color={colors.brand} size={22} />
            <Text variant="h3" style={{ marginTop: spacing[2] }}>
              Call us
            </Text>
            <Text variant="caption" tone="muted">
              9am \u2014 9pm
            </Text>
          </Card>
        </Pressable>
      </View>

      <Text variant="h2" style={{ marginTop: spacing[6] }}>
        Your tickets
      </Text>
      <View style={{ marginTop: spacing[2], gap: spacing[2] }}>
        {tickets.isLoading ? (
          <Card>
            <Skeleton width="50%" />
            <Skeleton width="80%" style={{ marginTop: 8 }} />
          </Card>
        ) : (tickets.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No open tickets"
            subtitle="We aim to resolve everything in chat. If something needs deeper attention, open a ticket here."
            icon={<HeadphonesIcon size={26} />}
          />
        ) : (
          (tickets.data ?? []).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/support/${t.id}`)}
              accessibilityRole="button"
            >
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                    {t.subject}
                  </Text>
                  <Badge
                    tone={
                      t.status === 'RESOLVED' || t.status === 'CLOSED'
                        ? 'success'
                        : t.status === 'AWAITING_CUSTOMER' ||
                            t.status === 'WAITING_CUSTOMER'
                          ? 'warn'
                          : 'brand'
                    }
                    label={t.status.replace(/_/g, ' ').toLowerCase()}
                    small
                  />
                </View>
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  Last activity {formatRelative(t.lastMessageAt)}
                </Text>
                {t.unreadCount > 0 ? (
                  <Badge tone="danger" label={`${t.unreadCount} new`} small />
                ) : null}
              </Card>
            </Pressable>
          ))
        )}
        <Button
          label="Open a new ticket"
          variant="outline"
          onPress={() => {
            track(Events.SupportTicketOpen, { source: params.bookingId ? 'booking' : 'support' });
            setOpen(true);
          }}
          style={{ marginTop: spacing[2] }}
        />
      </View>

      <Text variant="h2" style={{ marginTop: spacing[6] }}>
        FAQs
      </Text>
      <View style={{ marginTop: spacing[2], gap: spacing[2] }}>
        {(faqs.data ?? []).map((q, idx) => {
          const isOpen = expanded === idx;
          return (
            <Pressable
              key={idx}
              onPress={() => setExpanded(isOpen ? null : idx)}
              accessibilityRole="button"
            >
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <Text variant="h3" style={{ flex: 1 }}>
                    {q.q}
                  </Text>
                  {isOpen ? (
                    <ChevronDown size={16} color={colors.inkMuted} />
                  ) : (
                    <ChevronRight size={16} color={colors.inkMuted} />
                  )}
                </View>
                {isOpen ? (
                  <Text variant="caption" tone="muted" style={{ marginTop: spacing[2] }}>
                    {q.a}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Sheet open={open} onClose={() => setOpen(false)} title="New ticket">
        <Input
          label="Subject"
          placeholder="What\u2019s this about?"
          value={form.subject}
          onChangeText={(v) => setForm({ ...form, subject: v })}
        />
        <View style={{ marginTop: spacing[3] }}>
          <Input
            label="Tell us more"
            placeholder="Add as much detail as you can."
            value={form.message}
            onChangeText={(v) => setForm({ ...form, message: v })}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
        </View>
        <Button
          label="Submit ticket"
          fullWidth
          size="lg"
          loading={create.isPending}
          disabled={form.subject.trim().length < 3 || form.message.trim().length < 8}
          onPress={async () => {
            try {
              await create.mutateAsync({
                subject: form.subject.trim(),
                message: form.message.trim(),
                bookingId: params.bookingId,
              });
              setOpen(false);
              setForm({ subject: '', message: '' });
              Alert.alert('Ticket created', 'We\u2019ll get back to you shortly.');
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Try again.');
            }
          }}
          style={{ marginTop: spacing[3] }}
        />
      </Sheet>
    </Screen>
  );
}
