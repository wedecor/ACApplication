import { Fingerprint } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getBiometricEnabled, requireBiometric } from '@/lib/biometric';
import { useAuthStore } from '@/state/auth-store';
import { colors, spacing } from '@/theme/tokens';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

/**
 * App lock for customers who turned on "Biometric unlock": covers the app on
 * cold start and when returning after a minute away, until Face ID /
 * fingerprint (or the device passcode) succeeds.
 */
export function BiometricGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (await requireBiometric('Unlock AC Platform')) setLocked(false);
  }, []);

  const lockIfEnabled = useCallback(async () => {
    if (status !== 'authenticated') return;
    if (await getBiometricEnabled()) {
      setLocked(true);
      void unlock();
    }
  }, [status, unlock]);

  // Cold start / sign-in.
  useEffect(() => {
    void lockIfEnabled();
  }, [lockIfEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= RELOCK_AFTER_MS) void lockIfEnabled();
      }
    });
    return () => sub.remove();
  }, [lockIfEnabled]);

  if (status !== 'authenticated' || !locked) return <>{children}</>;
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.bg, gap: spacing[4] }}
    >
      <Fingerprint size={48} color={colors.brand} />
      <Text variant="h2">App locked</Text>
      <Text tone="muted" style={{ textAlign: 'center' }}>
        Unlock with Face ID, fingerprint or your device passcode.
      </Text>
      <Button label="Unlock" onPress={() => void unlock()} />
      <Button label="Sign out" variant="ghost" onPress={() => void logout()} />
    </View>
  );
}
