import { Image, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Button, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { useI18n } from '../../i18n/I18nContext';
import type { AuthStackParamList } from '../../navigation/types';

const logo = require('../../../assets/logo.jpg');

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();

  return (
    <Screen padded={false} style={{ backgroundColor: colors.ink }}>
      <View style={{ flex: 1, paddingHorizontal: 30 }}>
        <View style={{ alignItems: 'flex-end', paddingTop: spacing.xl }}>
          <LanguageToggle tone="dark" />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={logo}
            style={{
              width: 220,
              height: 220,
              borderRadius: 24,
              marginBottom: spacing.lg,
            }}
            resizeMode="cover"
          />
          <Text
            style={{
              marginTop: spacing.xxl,
              maxWidth: 250,
              color: '#B1B1B9',
              fontSize: font.size.lg,
              lineHeight: 24,
              textAlign: 'center',
            }}
          >
            {t('welcomeTagline')}
          </Text>
        </View>

        <View style={{ paddingBottom: spacing.xl, gap: spacing.md }}>
          <Button
            title={t('createAccount')}
            variant="accent"
            onPress={() => navigation.navigate('SignUp')}
          />
          <Button
            title={t('alreadyHaveAccount')}
            variant="secondary"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'rgba(255, 255, 255, 0.18)',
              borderRadius: radius.lg,
            }}
            textStyle={{ color: colors.card, fontWeight: font.weight.medium }}
            onPress={() => navigation.navigate('SignIn')}
          />
        </View>
      </View>
    </Screen>
  );
}
