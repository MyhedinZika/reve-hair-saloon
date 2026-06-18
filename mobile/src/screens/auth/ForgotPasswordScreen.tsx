import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Heading,
  IconButton,
  Input,
  MutedText,
  Screen,
} from '../../theme/components';
import { LanguageToggle } from '../../components/LanguageToggle';
import { sendPasswordReset } from '../../auth/api';
import { getAuthErrorMessage } from '../../auth/errors';
import { useI18n } from '../../i18n/I18nContext';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async (): Promise<void> => {
    setError(null);
    setSent(false);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('passwordResetEmailRequired'));
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(trimmedEmail);
      setSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, t, 'loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ backgroundColor: colors.card }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        overScrollMode="never"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label={t('back')} onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
          </IconButton>
          <LanguageToggle />
        </View>

        <View style={{ marginTop: 34 }}>
          <Heading level={1}>{t('forgotPasswordTitle')}</Heading>
          <MutedText style={{ marginTop: spacing.xs, marginBottom: spacing.xxl }}>
            {t('forgotPasswordSubtitle')}
          </MutedText>

          <Input
            label={t('emailAddress')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            errorText={error}
            placeholder="perdoruesi@email.com"
          />

          {sent ? (
            <Text
              style={{
                color: colors.success,
                fontSize: font.size.sm,
                lineHeight: 18,
                marginTop: -spacing.xs,
                marginBottom: spacing.lg,
              }}
            >
              {t('passwordResetSent')}
            </Text>
          ) : null}

          <Button title={t('sendResetLink')} onPress={handleSend} loading={loading} />
        </View>

        <View style={{ flex: 1 }} />

        <Button
          title={t('backToSignIn')}
          variant="ghost"
          onPress={() => navigation.navigate('SignIn')}
          style={{ marginTop: spacing.xl }}
          textStyle={{ color: colors.accent }}
        />
      </ScrollView>
    </Screen>
  );
}
