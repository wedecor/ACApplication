import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { registerLocationTasks } from '../src/lib/location';

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
            <Stack.Screen name="jobs/[id]" options={{ title: 'Job details' }} />
            <Stack.Screen name="inventory/index" options={{ title: 'Van inventory' }} />
            <Stack.Screen name="inventory/scan" options={{ title: 'Scan SKU' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
