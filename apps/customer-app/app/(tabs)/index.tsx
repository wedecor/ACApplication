import { useRouter } from 'expo-router';
import { Bell, FileText, HeartHandshake, MessageCircle, Search } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { ActiveBookingCard } from '@/components/home/active-booking-card';
import { AmcStatusCard } from '@/components/home/amc-status-card';
import { EmergencyCta } from '@/components/home/emergency-cta';
import { QuickServices } from '@/components/home/quick-services';
import { SectionHeader } from '@/components/home/section-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMyAmc } from '@/hooks/use-amc';
import { useBookings } from '@/hooks/use-bookings';
import { useInvoices } from '@/hooks/use-invoices';
import { useNotifications } from '@/hooks/use-notifications';
import { formatRupees } from '@/lib/format';
import { useIsOnline } from '@/lib/network';
import { useAuthStore } from '@/state/auth-store';
import { colors, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const online = useIsOnline();
  const greeting = useMemo(() => greetingFor(new Date()), []);

  const bookings = useBookings('active');
  const amc = useMyAmc();
  const invoices = useInvoices();
  const notifications = useNotifications();

  const unread = useMemo(
    () => (notifications.data ?? []).filter((n) => !n.readAt).length,
    [notifications.data],
  );

  const activeBooking = (bookings.data ?? [])[0];
  const activeAmc = (amc.data ?? []).find((s) => s.status === 'ACTIVE' || s.status === 'EXPIRING');
  const pendingInvoice = (invoices.data ?? []).find((i) => i.status === 'PENDING' || i.status === 'PARTIAL');

  const refreshing =
    bookings.isFetching || amc.isFetching || invoices.isFetching || notifications.isFetching;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            bookings.refetch();
            amc.refetch();
            invoices.refetch();
            notifications.refetch();
          }}
        />
      }
    >
      <Header
        name={profile?.fullName ?? 'there'}
        greeting={greeting}
        unread={unread}
        onBell={() => router.push('/notifications')}
        onSearch={() => router.push('/book')}
      />

      {!online ? (
        <View style={{ marginTop: spacing[3] }}>
          <Badge tone="warn" label="You\u2019re offline \u2014 showing cached info" />
        </View>
      ) : null}

      <SectionHeader title="Active booking" />
      {bookings.isLoading ? (
        <Card>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={14} style={{ marginTop: 12 }} />
        </Card>
      ) : activeBooking ? (
        <ActiveBookingCard booking={activeBooking} />
      ) : (
        <Card>
          <Text variant="h3">No active bookings</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            Tap below to book a verified pro in minutes.
          </Text>
          <Button
            label="Book a service"
            onPress={() => router.push('/book')}
            style={{ marginTop: spacing[3] }}
            fullWidth
            haptic
          />
        </Card>
      )}

      <SectionHeader title="Quick book" />
      <QuickServices />

      <SectionHeader title="Membership" />
      <AmcStatusCard subscription={activeAmc ?? null} />

      <View style={{ marginTop: spacing[4] }}>
        <EmergencyCta />
      </View>

      {pendingInvoice ? (
        <>
          <SectionHeader
            title="Pending payment"
            trailing={
              <Text variant="caption" tone="brand" weight="600" onPress={() => router.push('/(tabs)/invoices')}>
                See all
              </Text>
            }
          />
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">{pendingInvoice.number}</Text>
                <Text variant="caption" tone="muted">
                  Issued {new Date(pendingInvoice.issuedAt).toLocaleDateString()}
                </Text>
              </View>
              <Text variant="h2">{formatRupees(pendingInvoice.amountMinor)}</Text>
            </View>
            <Button
              label="Pay now"
              variant="accent"
              fullWidth
              style={{ marginTop: spacing[3] }}
              onPress={() => router.push(`/invoice/${pendingInvoice.id}`)}
            />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Help" />
      <View style={{ gap: spacing[3] }}>
        <ShortcutRow
          icon={<MessageCircle color={colors.brand} size={18} />}
          title="Chat with support"
          subtitle="We typically reply within 5 mins"
          onPress={() => router.push('/support')}
        />
        <ShortcutRow
          icon={<FileText color={colors.brand} size={18} />}
          title="Service history"
          subtitle="Re-book past services in one tap"
          onPress={() => router.push('/(tabs)/bookings')}
        />
        <ShortcutRow
          icon={<HeartHandshake color={colors.brand} size={18} />}
          title="Refer & earn"
          subtitle="Invite friends, get \u20B9300 credit"
          onPress={() => router.push('/profile/referrals')}
        />
      </View>
    </Screen>
  );
}

function Header({
  name,
  greeting,
  unread,
  onBell,
  onSearch,
}: {
  name: string;
  greeting: string;
  unread: number;
  onBell: () => void;
  onSearch: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing[2],
      }}
    >
      <View>
        <Text variant="caption" tone="muted">
          {greeting}
        </Text>
        <Text variant="h1">Hi, {name.split(' ')[0]}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Pressable
          onPress={onSearch}
          accessibilityLabel="Search services"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Search size={18} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={onBell}
          accessibilityLabel="Notifications"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={18} color={colors.ink} />
          {unread > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 8,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.danger,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="micro" tone="inverse" weight="700">
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

function ShortcutRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing[4] }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.brand50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </View>
          <View style={{ marginLeft: spacing[3], flex: 1 }}>
            <Text variant="h3">{title}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
