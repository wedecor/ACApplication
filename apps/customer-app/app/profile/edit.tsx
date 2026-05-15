import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import { profileApi } from '@/api/endpoints';
import { useAuthStore } from '@/state/auth-store';
import { spacing } from '@/theme/tokens';

export default function EditProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.fullName ?? '');
    setEmail(profile?.email ?? '');
  }, [profile?.fullName, profile?.email]);

  async function save() {
    setSaving(true);
    try {
      await profileApi.update({ fullName, email: email || undefined });
      await refreshProfile();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded>
      <SubHeader title="Edit profile" />
      <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
        <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
        />
        <Input
          label="Phone"
          editable={false}
          value={profile?.phone ?? ''}
          hint="Need to change? Reach out to support."
        />
      </View>
      <Button label="Save changes" fullWidth size="lg" loading={saving} onPress={save} style={{ marginTop: spacing[4] }} />
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center', marginTop: spacing[3] }}>
        We never share your details with technicians beyond what\u2019s needed for the visit.
      </Text>
    </Screen>
  );
}
