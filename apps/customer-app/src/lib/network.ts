import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * `useIsOnline()` returns the current network reachability state.
 *
 * Backed by `@react-native-community/netinfo`. We treat
 * `isInternetReachable === false` as offline because Wi-Fi without
 * connectivity (captive portals, etc.) is still effectively offline
 * for our purposes.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let mounted = true;
    NetInfo.fetch()
      .then((s) => mounted && setOnline(isReachable(s)))
      .catch(() => undefined);
    const unsubscribe = NetInfo.addEventListener((s) => {
      if (!mounted) return;
      setOnline(isReachable(s));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  return online;
}

function isReachable(s: NetInfoState): boolean {
  if (s.isConnected === false) return false;
  if (s.isInternetReachable === false) return false;
  return true;
}
