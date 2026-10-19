import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { registerLocationTasks } from '../src/lib/location';
import { flushWriteQueue } from '../src/lib/write-queue';

const WRITE_FLUSH_INTERVAL_MS = 30_000;

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
    [],
  );

  // Register the foreground + background location TaskManager handlers
  // once at app boot — they're idempotent.
  useEffect(() => {
    registerLocationTasks();
  }, []);

  // Drain queued field writes (job-card edits, photos, signatures).
  useEffect(() => {
    void flushWriteQueue().catch(() => undefined);
    const t = setInterval(() => {
      void flushWriteQueue().catch(() => undefined);
    }, WRITE_FLUSH_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0E7A4A' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'AC Technician' }} />
            <Stack.Screen name="login" options={{ title: 'Sign in' }} />
            <Stack.Screen name="jobs/[id]" options={{ title: 'Job details' }} />
            <Stack.Screen name="inventory/index" options={{ title: 'Van inventory' }} />
            <Stack.Screen name="inventory/scan" options={{ title: 'Scan SKU' }} />
            <Stack.Screen name="job-card/[id]" options={{ title: 'Job card' }} />
            <Stack.Screen name="photos/[id]" options={{ title: 'Job photos' }} />
            <Stack.Screen name="quote/[id]" options={{ title: 'On-site quotation' }} />
            <Stack.Screen name="payment/[id]" options={{ title: 'Collect payment' }} />
            <Stack.Screen name="signature/[id]" options={{ title: 'Customer sign-off' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Root crash screen (Expo Router picks up this export). Queued job updates
 * stay on the device, so retrying is safe.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error(error);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#F5F7FA' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A' }}>Something went wrong</Text>
      <Text style={{ color: '#64748B', textAlign: 'center' }}>
        The app hit an unexpected error. Job updates you saved offline are kept on this phone.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ marginTop: 8, minHeight: 48, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: '#0E7A4A' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}
