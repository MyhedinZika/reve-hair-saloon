import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BodyText, Card, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { useI18n } from '../../i18n/I18nContext';
import type { AdminManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminManageStackParamList, 'ManageHub'>;

export function ManageHubScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Heading level={2}>{t('manage')}</Heading>
        <MutedText>{t('manageOperationsSubtitle')}</MutedText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ManageRow
          title={t('newAppointment')}
          subtitle={t('bookClientWalkIn')}
          primary
          onPress={() => navigation.navigate('CreateAppointment')}
        />
        <ManageRow
          title={t('barbers')}
          subtitle={t('staffProfilesServicesHours')}
          onPress={() => navigation.navigate('ManageBarbers')}
        />
        <ManageRow
          title={t('services')}
          subtitle={t('serviceNamesPrices')}
          onPress={() => navigation.navigate('ManageServices')}
        />
        <ManageRow
          title={t('salonSettings')}
          subtitle={t('bookingRulesContacts')}
          onPress={() => navigation.navigate('ManageSettings')}
        />
        <ManageRow
          title={t('blockedUsers')}
          subtitle={t('preventBookingMisuse')}
          onPress={() => navigation.navigate('ManageBlocked')}
        />
      </ScrollView>
    </Screen>
  );
}

interface ManageRowProps {
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
}

function ManageRow({ title, subtitle, primary, onPress }: ManageRowProps): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed ? { opacity: 0.86 } : null}>
      <Card style={[styles.row, primary ? styles.rowPrimary : null]}>
        <View style={{ flex: 1 }}>
          <BodyText
            style={{
              fontWeight: font.weight.semibold,
              color: primary ? colors.card : colors.ink,
            }}
          >
            {title}
          </BodyText>
          <MutedText
            style={{
              color: primary ? 'rgba(255, 255, 255, 0.72)' : colors.mutedStrong,
              marginTop: 2,
            }}
          >
            {subtitle}
          </MutedText>
        </View>
        <Text style={[styles.chevron, primary ? { color: colors.card } : null]}>{'>'}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  row: {
    minHeight: 74,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowPrimary: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chevron: {
    color: colors.muted,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
  },
});
