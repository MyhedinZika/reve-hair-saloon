import { Alert, View } from 'react-native';
import {
  BodyText,
  Button,
  Card,
  Divider,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { font, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';

export function ProfileScreen(): React.JSX.Element {
  const { profile, signOut } = useAuth();

  const handleExport = async (): Promise<void> => {
    try {
      const result = await api.exportClientHistory();
      Alert.alert(
        'Export ready',
        `Your history contains ${result.appointments.length} appointment(s). Saved locally — share/save it now if you need it.`,
      );
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (!profile) {
    return (
      <Screen>
        <BodyText>Loading…</BodyText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Profile</Heading>
      <Card>
        <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
          {profile.displayName}
        </BodyText>
        {profile.email ? <MutedText>{profile.email}</MutedText> : null}
        {profile.phone ? <MutedText>{profile.phone}</MutedText> : null}
        <Divider />
        <MutedText>Role: {profile.role}</MutedText>
      </Card>

      <View style={{ height: spacing.xl }} />

      {profile.role === 'client' ? (
        <Button title="Export my data" variant="secondary" onPress={handleExport} />
      ) : null}

      <View style={{ height: spacing.md }} />

      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}
