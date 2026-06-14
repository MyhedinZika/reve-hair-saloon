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
import { colors, font, spacing } from '../../theme/tokens';
import { signUpWithEmail } from '../../auth/api';
import { useI18n } from '../../i18n/I18nContext';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (): Promise<void> => {
    setError(null);
    if (name.trim().length < 2) {
      setError(t('signupNameValidation'));
      return;
    }
    if (password.length < 6) {
      setError(t('passwordValidation'));
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, name.trim(), phone.trim() || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('signUpError');
      setError(msg);
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
          <Heading level={1}>{t('createAccount')}</Heading>
          <MutedText style={{ marginTop: spacing.xs, marginBottom: spacing.xxl }}>
            {t('signUpDetails')}
          </MutedText>

          <Input
            label={t('fullName')}
            value={name}
            onChangeText={setName}
            placeholder="Amelia Krasniqi"
          />
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
            label={t('phoneNumber')}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="+383 4_ ___ ___"
          />
          <Input
            label={t('password')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            errorText={error}
            placeholder={t('passwordMin')}
          />

          <Text
            style={{
              marginTop: spacing.xs,
              marginBottom: spacing.xl,
              color: colors.muted,
              fontSize: font.size.sm,
              lineHeight: 18,
            }}
          >
            {t('termsCopy')}
          </Text>

          <Button title={t('createAccount')} onPress={handleSignUp} loading={loading} />
        </View>

        <View style={{ flex: 1 }} />

        <Button
          title={t('alreadyHaveAccount')}
          variant="ghost"
          onPress={() => navigation.navigate('SignIn')}
          style={{ marginTop: spacing.xl }}
          textStyle={{ color: colors.accent }}
        />
      </ScrollView>
    </Screen>
  );
}
