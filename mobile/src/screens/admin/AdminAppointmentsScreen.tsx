import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, AppointmentStatus, BarberDoc } from '@salon/shared';
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
import { useI18n } from '../../i18n/I18nContext';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { AdminAppointmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminAppointmentsStackParamList, 'AppointmentsList'>;

export function AdminAppointmentsScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();
  const [items, setItems] = useState<AppointmentDoc[]>([]);
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [barberFilter, setBarberFilter] = useState<string>('all');

  useEffect(() => {
    const unsub = stores.watchAllAppointments(setItems);
    return () => unsub();
  }, []);

  useEffect(() => {
    stores.listBarbers().then(setBarbers).catch(() => setBarbers([]));
  }, []);

  const filtered = useMemo(() => {
    return items
      .filter((appointment) => barberFilter === 'all' || appointment.barberId === barberFilter)
      .sort((a, b) => a.startAt - b.startAt);
  }, [items, barberFilter]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Heading level={2}>{t('appointments')}</Heading>
        <MutedText>{t('manageAppointmentsSubtitle')}</MutedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentRow}
        >
          <Pill
            label={t('all')}
            selected={barberFilter === 'all'}
            selectedTone="accent"
            onPress={() => setBarberFilter('all')}
          />
          {barbers.map((barber) => (
            <Pill
              key={barber.id}
              label={firstWord(barber.displayName)}
              selected={barberFilter === barber.id}
              selectedTone="accent"
              onPress={() => setBarberFilter(barber.id)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Card style={styles.emptyCard}>
            <BodyText style={{ fontWeight: font.weight.semibold }}>{t('none')}</BodyText>
            <MutedText style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {t('noAppointmentsFilter')}
            </MutedText>
          </Card>
        ) : null}

        {filtered.map((appointment) => (
          <AppointmentRow
            key={appointment.id}
            appointment={appointment}
            barber={barbers.find((item) => item.id === appointment.barberId) ?? null}
            onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

interface AppointmentRowProps {
  appointment: AppointmentDoc;
  barber: BarberDoc | null;
  onPress: () => void;
}

function AppointmentRow({ appointment, barber, onPress }: AppointmentRowProps): React.JSX.Element {
  const { t } = useI18n();
  const clientLabel = appointment.guestClient ? appointment.guestClient.name : t('registeredClient');
  const confirmed = appointment.status === 'confirmed';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed ? { opacity: 0.85 } : null]}>
      <View style={styles.timeBlock}>
        <Text style={styles.timeText}>{formatTimeOfDay(appointment.startAt)}</Text>
        <Text style={styles.timeSubtext}>{formatDateLong(appointment.startAt)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <BodyText style={{ fontWeight: font.weight.semibold }}>{clientLabel}</BodyText>
        <MutedText style={{ marginTop: 2 }}>
          {t('serviceCount', { count: appointment.serviceIds.length })} - {barber?.displayName ?? t('barber')} - {statusLabel(appointment.status, t)}
        </MutedText>
      </View>
      <View style={[styles.statusBadge, confirmed ? styles.statusBadgeActive : null]}>
        <Text style={[styles.statusBadgeText, confirmed ? styles.statusBadgeTextActive : null]}>
          {confirmed ? t('liveStatus') : t('doneStatus')}
        </Text>
      </View>
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

function firstWord(value: string): string {
  return value.split(' ')[0] ?? value;
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
  timeBlock: {
    width: 74,
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.bgAlt,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  timeText: {
    color: colors.ink,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  timeSubtext: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
  },
  statusBadgeActive: {
    backgroundColor: colors.successSoft,
  },
  statusBadgeText: {
    color: colors.muted,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  statusBadgeTextActive: {
    color: colors.success,
  },
});
