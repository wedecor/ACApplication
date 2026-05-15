import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ShieldCheck, Sparkles, Timer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme/tokens';

const HIGHLIGHTS = [
  {
    icon: <Sparkles color="#fff" size={18} />,
    title: 'Verified pros at your door',
    sub: 'Background-checked technicians, transparent pricing.',
  },
  {
    icon: <Timer color="#fff" size={18} />,
    title: '60-min response',
    sub: 'Same-day & emergency repairs across all major cities.',
  },
  {
    icon: <ShieldCheck color="#fff" size={18} />,
    title: '90-day service warranty',
    sub: 'Every job is covered. If it breaks again, we fix it free.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.brand700 }}>
      <LinearGradient
        colors={['#0f59db', '#062b65']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: spacing[6] }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 999,
              paddingHorizontal: spacing[3],
              paddingVertical: 6,
              marginBottom: spacing[4],
            }}
          >
            <Text tone="inverse" variant="caption">
              India\u2019s most trusted appliance repair platform
            </Text>
          </View>
          <Text tone="inverse" style={{ fontSize: 36, fontWeight: '800', lineHeight: 42 }}>
            Repairs that actually{'\n'}feel premium.
          </Text>
          <Text tone="inverse" variant="body" style={{ marginTop: spacing[3], opacity: 0.85 }}>
            Book trusted technicians for ACs, washing machines, refrigerators and more \u2014 with
            live tracking and upfront pricing.
          </Text>
          <View style={{ marginTop: spacing[6], gap: spacing[3] }}>
            {HIGHLIGHTS.map((h) => (
              <View
                key={h.title}
                style={{
                  flexDirection: 'row',
                  gap: spacing[3],
                  alignItems: 'flex-start',
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {h.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text tone="inverse" variant="h3">
                    {h.title}
                  </Text>
                  <Text tone="inverse" variant="caption" style={{ opacity: 0.8 }}>
                    {h.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ marginTop: spacing[10], gap: spacing[3] }}>
            <Button
              label="Continue with phone"
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => router.push('/(auth)/login')}
            />
            <Text tone="inverse" variant="micro" style={{ textAlign: 'center', opacity: 0.7 }}>
              By continuing you agree to our Terms and Privacy Policy.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
