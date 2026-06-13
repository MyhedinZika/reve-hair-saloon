import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, AppointmentStatus, BarberDoc, ServiceDoc } from '@salon/shared';
import {
  BodyText,
  Card,
  Heading,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { ClientStackParamList, ClientTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ClientTabParamList, 'Appointments'>,
  NativeStackScreenProps<ClientStackParamList>
>;

type Filter = 'upcoming' | 'past';

export function AppointmentsScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<AppointmentDoc[]>([]);
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');

  useEffect(() => {
    if (!profile) return;
    const unsub = stores.watchClientAppointments(profile.uid, setItems);
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    Promise.all([stores.listBarbers(), stores.listServices()])
      .then(([barberDocs, serviceDocs]) => {
        setBarbers(barberDocs);
        setServices(serviceDocs);
      })
      .catch(() => {
        setBarbers([]);
        setServices([]);
      });
  }, []);

  const upcoming = useMemo(
    () => items.filter((a) => a.status === 'confirmed').sort((a, b) => a.startAt - b.startAt),
    [items],
  );
  const past = useMemo(
    () => items.filter((a) => a.status !== 'confirmed').sort((a, b) => b.startAt - a.startAt),
    [items],
  );
  const visible = filter === 'upcoming' ? upcoming : past;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Heading level={2}>{t('myBookings')}</Heading>
        <View style={styles.segmentRow}>
          <Pill
            label={`${t('upcoming')} ${upcoming.length}`}
            selected={filter === 'upcoming'}
            selectedTone="accent"
            onPress={() => setFilter('upcoming')}
            style={{ flex: 1 }}
          />
          <Pill
            label={`${t('past')} ${past.length}`}
            selected={filter === 'past'}
            selectedTone="accent"
            onPress={() => setFilter('past')}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>0</Text>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {filter === 'upcoming' ? t('noUpcomingBookings') : t('noPastBookings')}
            </BodyText>
            <MutedText style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {t('appointmentsAppearHere')}
            </MutedText>
          </Card>
        ) : null}

        {visible.map((appointment) => (
          <AppointmentRow
            key={appointment.id}
            appointment={appointment}
            barber={barbers.find((item) => item.id === appointment.barberId) ?? null}
            services={services.filter((item) => appointment.serviceIds.includes(item.id))}
            statusLabel={statusLabel(appointment.status, t)}
            onPress={() =>
              navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })
            }
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

interface RowProps {
  appointment: AppointmentDoc;
  barber: BarberDoc | null;
  onPress: () => void;
  services: ServiceDoc[];
  statusLabel: string;
}

function AppointmentRow({ appointment, barber, onPress, services, statusLabel }: RowProps): React.JSX.Element {
  const { t } = useI18n();
  const isConfirmed = appointment.status === 'confirmed';
  const serviceLabel =
    services.length > 0 ? services.map((service) => service.name).join(' & ') : t('serviceCount', { count: appointment.serviceIds.length });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed ? { opacity: 0.85 } : null]}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateBadgeDay}>{formatTimeOfDay(appointment.startAt)}</Text>
        <Text style={styles.dateBadgeLabel}>{formatDateLong(appointment.startAt)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <BodyText style={{ fontWeight: font.weight.semibold }}>
          {serviceLabel}
        </BodyText>
        <MutedText style={{ marginTop: 2 }}>
          {barber?.displayName ?? t('barber')} - {statusLabel}
        </MutedText>
      </View>
      <View style={[styles.statusDot, isConfirmed ? styles.statusDotActive : null]} />
    </Pressable>
  );
}

function statusLabel(status: AppointmentStatus, t: ReturnType<typeof useI18n>['t']): string {
  const labels: Record<AppointmentStatus, string> = {
    confirmed: t('appointmentConfirmed'),
    completed: t('appointmentCompleted'),
    cancelledByClient: t('appointmentCancelled'),
    cancelledByAdmin: t('appointmentCancelledBySalon'),
    noShow: t('appointmentNoShow'),
  };
  return labels[status];
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    color: colors.accent,
    fontSize: 38,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.md,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateBadge: {
    width: 74,
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  dateBadgeDay: {
    color: colors.accentDark,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  dateBadgeLabel: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  statusDotActive: {
    backgroundColor: colors.success,
  },
});
