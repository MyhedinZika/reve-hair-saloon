import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
import { colors, font, spacing } from '../../theme/tokens';
import { sendPasswordReset, signInWithEmail } from '../../auth/api';
import { getAuthErrorMessage } from '../../auth/errors';
import { useGoogleSignIn } from '../../auth/google';
import { useI18n } from '../../i18n/I18nContext';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const google = useGoogleSignIn();

  const handleSignIn = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(getAuthErrorMessage(err, t, 'loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await google.prompt();
    } catch (err) {
      setError(getAuthErrorMessage(err, t, 'loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('passwordResetEmailRequired'));
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(trimmedEmail);
      setNotice(t('passwordResetSent'));
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label={t('back')} onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
          </IconButton>
          <LanguageToggle />
        </View>

        <View style={{ marginTop: 34 }}>
          <Heading level={1}>{t('welcomeBack')}</Heading>
          <MutedText style={{ marginTop: spacing.xs, marginBottom: spacing.xxl }}>
            {t('signInSubtitle')}
          </MutedText>

          <Input
            label={t('emailAddress')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="amelia.k@email.com"
          />
          <Input
            label={t('password')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            errorText={error}
            placeholder={t('password')}
          />

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={handleForgotPassword}
            style={{
              marginTop: -spacing.xs,
              marginBottom: spacing.lg,
              alignSelf: 'flex-end',
            }}
          >
            <Text
              style={{
                color: loading ? colors.muted : colors.accent,
                fontSize: font.size.md,
                fontWeight: font.weight.medium,
                textAlign: 'right',
              }}
            >
              {t('forgotPassword')}
            </Text>
          </Pressable>

          {notice ? (
            <Text
              style={{
                color: colors.success,
                fontSize: font.size.sm,
                lineHeight: 18,
                marginTop: -spacing.sm,
                marginBottom: spacing.lg,
              }}
            >
              {notice}
            </Text>
          ) : null}

          <Button title={t('signIn')} onPress={handleSignIn} loading={loading} />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.lg,
              marginVertical: spacing.xl,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.mutedSoft, fontSize: font.size.sm }}>{t('or')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Button
            title={t('continueWithGoogle')}
            variant="secondary"
            onPress={handleGoogle}
            disabled={!google.ready || loading}
          />
        </View>

        <View style={{ flex: 1 }} />

        <Button
          title={t('createAccount')}
          variant="ghost"
          onPress={() => navigation.navigate('SignUp')}
          style={{ marginTop: spacing.xl }}
          textStyle={{ color: colors.accent }}
        />
      </ScrollView>
    </Screen>
  );
}
