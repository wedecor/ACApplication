import { Redirect } from 'expo-router';

import { useAuthStore } from '@/state/auth-store';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/welcome" />;
}
