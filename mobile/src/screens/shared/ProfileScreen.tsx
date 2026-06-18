import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  BodyText,
  Button,
  Card,
  Divider,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { LanguageToggle } from '../../components/LanguageToggle';
import { colors, font, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';

export function ProfileScreen(): React.JSX.Element {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);

  const doDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      await api.deleteMyAccount();
      // The server has invalidated our auth uid; sign out to clear local state
      // and bounce the user back to the welcome screen.
      await signOut();
    } catch (err) {
      Alert.alert(
        t('deleteAccountFailed'),
        err instanceof Error ? err.message : t('unknownError'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = (): void => {
    Alert.alert(
      t('deleteAccountConfirmTitle'),
      t('deleteAccountConfirmBody'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirmDelete'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              t('deleteAccountFinalTitle'),
              t('deleteAccountFinalBody'),
              [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('confirmDelete'),
                  style: 'destructive',
                  onPress: () => void doDelete(),
                },
              ],
            ),
        },
      ],
    );
  };

  if (!profile) {
    return (
      <Screen>
        <BodyText>{t('loading')}</BodyText>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Heading level={2}>{t('profile')}</Heading>
        <MutedText>{t('profileSubtitle')}</MutedText>
      </View>

      <View style={styles.content}>
      <Card>
        <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
          {profile.displayName}
        </BodyText>
        {profile.email ? <MutedText>{profile.email}</MutedText> : null}
        {profile.phone ? <MutedText>{profile.phone}</MutedText> : null}
        <Divider />
        <MutedText>{t('role', { role: profile.role })}</MutedText>
      </Card>

      <View style={{ height: spacing.xl }} />

      <Card style={styles.languageCard}>
        <BodyText style={{ fontWeight: font.weight.semibold }}>{t('language')}</BodyText>
        <LanguageToggle />
      </Card>

      <View style={{ height: spacing.xl }} />

      <Button title={t('signOut')} variant="ghost" onPress={() => void signOut()} />

      <View style={{ height: spacing.xl }} />

      <Button
        title={deleting ? t('deleteAccountDeleting') : t('deleteAccount')}
        variant="ghost"
        loading={deleting}
        disabled={deleting}
        textStyle={{ color: colors.danger }}
        onPress={handleDeleteAccount}
      />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
