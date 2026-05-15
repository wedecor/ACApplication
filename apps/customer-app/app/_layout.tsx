import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { useAuthStore } from '@/state/auth-store';
import { realtime } from '@/lib/realtime';
import { identifyUser, track, Events } from '@/lib/analytics';
import {
  attachQueryPersistence,
  hydrateQueryClient,
} from '@/lib/query-persistence';
import { startQueueDrainer } from '@/lib/offline-queue';
import {
  addForegroundNotificationListener,
  addNotificationTapListener,
  registerForPushNotifications,
} from '@/lib/push';

function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const hydrated = useAuthStore((s) => s.isHydrated);
  const profile = useAuthStore((s) => s.profile);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!hydrated) return;
    const inAuth = segments[0] === '(auth)';
    if (status === 'unauthenticated' && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (status === 'authenticated' && inAuth) {
      router.replace('/(tabs)');
    }
  }, [status, hydrated, segments, router]);

  // Identify analytics user and connect realtime once authenticated.
  useEffect(() => {
    if (status === 'authenticated' && profile) {
      identifyUser(profile.id, profile.tenantId ?? null);
      void realtime.connect();
      void registerForPushNotifications();
    } else {
      identifyUser(null);
      realtime.disconnect();
    }
  }, [status, profile]);

  return <>{children}</>;
}

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      }),
    [],
  );

  useEffect(() => {
    let detach: (() => void) | undefined;
    let stopDrainer: (() => void) | undefined;
    let detachForeground: (() => void) | undefined;
    let detachTap: (() => void) | undefined;
    (async () => {
      await hydrateQueryClient(queryClient);
      detach = attachQueryPersistence(queryClient);
      stopDrainer = startQueueDrainer();
      detachForeground = addForegroundNotificationListener(() => {
        // Refresh notifications list when a push arrives in foreground.
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
      detachTap = addNotificationTapListener((response) => {
        track(Events.NotificationTap, {
          id: response.notification.request.identifier,
        });
      });
      track(Events.AppOpen);
      await useAuthStore.getState().hydrate();
    })();
    return () => {
      detach?.();
      stopDrainer?.();
      detachForeground?.();
      detachTap?.();
    };
  }, [queryClient]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
