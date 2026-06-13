import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  endOfDayUtcMs,
  startOfDayUtcMs,
  todayDateString,
  type AppointmentDoc,
  type ServiceDoc,
} from '@salon/shared';
import {
  BodyText,
  Card,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useI18n } from '../../i18n/I18nContext';
import type { AdminTabParamList } from '../../navigation/types';

export function AdminDashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<BottomTabNavigationProp<AdminTabParamList>>();
  const { t } = useI18n();
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);

  useEffect(() => {
    const unsub = stores.watchAllAppointments(setAppointments);
    return () => unsub();
  }, []);

  useEffect(() => {
    stores.listServices().then(setServices).catch(() => setServices([]));
  }, []);

  const stats = useMemo(() => {
    const today = todayDateString();
    const dayStart = startOfDayUtcMs(today);
    const dayEnd = endOfDayUtcMs(today);
    const todayAppts = appointments.filter((a) => a.startAt >= dayStart && a.startAt < dayEnd);
    const upcoming = appointments.filter((a) => a.status === 'confirmed' && a.startAt > Date.now());
    const revenueCents = todayAppts.reduce((total, appointment) => {
      return total + services
        .filter((service) => appointment.serviceIds.includes(service.id))
        .reduce((sum, service) => sum + service.priceCents, 0);
    }, 0);
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const noShows = appointments.filter((a) => a.status === 'noShow' && a.startAt >= weekStart);
    return {
      todayCount: todayAppts.length,
      upcomingCount: upcoming.length,
      revenueCents,
      noShowCount: noShows.length,
      utilisation: Math.min(99, Math.round((todayAppts.length / 12) * 100)),
      nextToday: todayAppts
        .filter((appointment) => appointment.status === 'confirmed' && appointment.startAt > Date.now())
        .sort((a, b) => a.startAt - b.startAt)
        .slice(0, 3),
    };
  }, [appointments, services]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.headerTopline}>
          <Heading level={2}>{t('dashboard')}</Heading>
          <Text style={styles.kicker}>{t('admin').toUpperCase()}</Text>
        </View>
        <MutedText>{t('adminDashboardSubtitle')}</MutedText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard label={t('todayLabel')} value={stats.todayCount} suffix={t('appointmentsLower')} />
          <StatCard label={t('revenue')} value={`EUR ${Math.round(stats.revenueCents / 100)}`} suffix={t('todayLower')} />
          <StatCard label={t('noShows')} value={stats.noShowCount} suffix={t('thisWeek')} />
          <StatCard label={t('utilisation')} value={`${stats.utilisation}%`} suffix={`${stats.upcomingCount} ${t('upcomingLower')}`} />
        </View>

        <Card style={{ gap: spacing.sm }}>
          <View style={styles.cardHeader}>
            <Heading level={3}>{t('nextUpToday')}</Heading>
            <Text style={styles.kicker}>{t('todayLabel').toUpperCase()}</Text>
          </View>
          {stats.nextToday.length === 0 ? (
            <MutedText>{t('noMoreConfirmedToday')}</MutedText>
          ) : (
            stats.nextToday.map((appointment) => (
              <View key={appointment.id} style={styles.nextRow}>
                <BodyText style={{ fontWeight: font.weight.semibold }}>
                  {new Date(appointment.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </BodyText>
                <MutedText style={{ flex: 1 }}>
                  {appointment.guestClient?.name ?? t('client')} - {t('serviceCount', { count: appointment.serviceIds.length })}
                </MutedText>
                <Text style={styles.statusText}>{t('appointmentConfirmed')}</Text>
              </View>
            ))
          )}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <View style={styles.cardHeader}>
            <Heading level={3}>{t('quickActions')}</Heading>
            <Text style={styles.kicker}>{t('admin').toUpperCase()}</Text>
          </View>
          <ActionRow
            title={t('newAppointment')}
            subtitle={t('bookClientWalkIn')}
            primary
            onPress={() => navigation.navigate('Manage', { screen: 'CreateAppointment' })}
          />
          <ActionRow
            title={t('manageBarbers')}
            subtitle={t('staffProfilesServicesHours')}
            onPress={() => navigation.navigate('Manage', { screen: 'ManageBarbers' })}
          />
          <ActionRow
            title={t('manageServices')}
            subtitle={t('pricesDurations')}
            onPress={() => navigation.navigate('Manage', { screen: 'ManageServices' })}
          />
          <ActionRow
            title={t('salonSettings')}
            subtitle={t('bookingRulesContacts')}
            onPress={() => navigation.navigate('Manage', { screen: 'ManageSettings' })}
          />
          <ActionRow
            title={t('blockedUsers')}
            subtitle={t('preventBookingMisuse')}
            onPress={() => navigation.navigate('Manage', { screen: 'ManageBlocked' })}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

interface StatCardProps {
  label: string;
  suffix: string;
  value: number | string;
}

function StatCard({ label, suffix, value }: StatCardProps): React.JSX.Element {
  return (
    <Card style={styles.statCard}>
      <BodyText style={{ fontSize: font.size.xxl, fontWeight: font.weight.semibold }}>
        {value}
      </BodyText>
      <MutedText>{label}</MutedText>
      <MutedText style={{ fontSize: font.size.xs }}>{suffix}</MutedText>
    </Card>
  );
}

interface ActionRowProps {
  title: string;
  subtitle: string;
  primary?: boolean;
  onPress: () => void;
}

function ActionRow({ title, subtitle, primary, onPress }: ActionRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        primary ? styles.actionRowPrimary : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
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
  headerTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48.5%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  kicker: {
    color: colors.accent,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.6,
  },
  actionRow: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionRowPrimary: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  nextRow: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.bgAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusText: {
    color: colors.success,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  chevron: {
    color: colors.muted,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
  },
});
