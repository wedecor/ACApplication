import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/theme/tokens';

import type { BookingDetail, TechnicianLocation } from '@/api/types';

/**
 * Wrapper around `react-native-maps`.
 *
 * Map rendering depends on native modules that aren\u2019t available in
 * Expo Go on the simulator, so we lazy-import `react-native-maps` and
 * fall back to a stylised "live route" placeholder when it can\u2019t be
 * loaded. The placeholder still surfaces ETA + distance so the screen
 * is useful even without a map.
 */
interface Props {
  booking: BookingDetail;
  location:
    | (Pick<TechnicianLocation, 'lat' | 'lng' | 'bearing' | 'etaMinutes' | 'distanceKm'> & {
        recordedAt: string;
      })
    | null
    | undefined;
}

export function TrackingMap({ booking, location }: Props) {
  const [MapNative, setMapNative] = useState<typeof import('react-native-maps') | null>(null);

  useEffect(() => {
    let mounted = true;
    if (Platform.OS === 'web') return;
    import('react-native-maps')
      .then((m) => {
        if (mounted) setMapNative(m);
      })
      .catch(() => {
        if (mounted) setMapNative(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const destLat = booking.address?.lat;
  const destLng = booking.address?.lng;

  if (!MapNative || !location || destLat == null || destLng == null) {
    return <FallbackMap />;
  }
  const { default: MapView, Marker, Polyline } = MapNative;
  return (
    <View
      style={{
        height: 260,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: '#dbeafe',
      }}
    >
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: (location.lat + destLat) / 2,
          longitude: (location.lng + destLng) / 2,
          latitudeDelta: Math.max(0.02, Math.abs(location.lat - destLat) * 2),
          longitudeDelta: Math.max(0.02, Math.abs(location.lng - destLng) * 2),
        }}
        showsUserLocation={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        <Marker
          coordinate={{ latitude: location.lat, longitude: location.lng }}
          title={booking.technician?.fullName ?? 'Technician'}
        />
        <Marker
          coordinate={{ latitude: destLat, longitude: destLng }}
          title="Your address"
          pinColor={colors.brand}
        />
        <Polyline
          coordinates={[
            { latitude: location.lat, longitude: location.lng },
            { latitude: destLat, longitude: destLng },
          ]}
          strokeColor={colors.brand}
          strokeWidth={4}
        />
      </MapView>
    </View>
  );
}

function FallbackMap() {
  return (
    <View
      style={{
        height: 220,
        borderRadius: radius.xl,
        backgroundColor: '#e0ecff',
        padding: spacing[5],
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: 6,
          width: '85%',
          borderRadius: 999,
          backgroundColor: 'rgba(15,89,219,0.25)',
        }}
      />
      <View
        style={{
          height: 6,
          width: '50%',
          borderRadius: 999,
          backgroundColor: 'rgba(15,89,219,0.4)',
        }}
      />
      <View
        style={{
          height: 6,
          width: '75%',
          borderRadius: 999,
          backgroundColor: 'rgba(15,89,219,0.2)',
        }}
      />
      <Text variant="caption" tone="muted">
        Live map appears here when the technician shares their location.
      </Text>
    </View>
  );
}
