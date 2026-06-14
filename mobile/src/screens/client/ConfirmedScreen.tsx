import { useEffect, useState } from 'react';
import { Linking, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, BarberDoc, ServiceDoc } from '@salon/shared';
import {
  BottomBar,
  Button,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateLong, formatPrice, formatTimeOfDay } from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'Confirmed'>;

export function ConfirmedScreen({ navigation, route }: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const { t } = useI18n();
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [barber, setBarber] = useState<BarberDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    if (!appointment) return;
    Promise.all([stores.listBarbers(), stores.listServices()]).then(([barberDocs, serviceDocs]) => {
      setBarber(barberDocs.find((b) => b.id === appointment.barberId) ?? null);
      setServices(serviceDocs.filter((s) => appointment.serviceIds.includes(s.id)));
    });
  }, [appointment]);

  const totalCents = services.reduce((acc, service) => acc + service.priceCents, 0);

  const viewAppointment = (): void => {
    const parent = navigation.getParent() as
      | { goBack: () => void; navigate: (name: string, params: { appointmentId: string }) => void }
      | undefined;
    if (parent) {
      parent.goBack();
      parent.navigate('AppointmentDetails', { appointmentId });
    }
  };

  const addToCalendar = (): void => {
    if (!appointment) return;
    const title = `${capitalize(serviceLabel)} - Rêve Hair Salon`;
    const details = `With ${barber?.displayName ?? 'your barber'} at Rêve Hair Salon.`;
    const dates = `${toGcalDate(appointment.startAt)}/${toGcalDate(appointment.endAt)}`;
    const url =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(title)}` +
      `&details=${encodeURIComponent(details)}` +
      `&dates=${dates}`;
    void Linking.openURL(url);
  };

  const serviceLabel =
    services.length > 0
      ? services.map((service) => service.name.toLowerCase()).join(' & ')
      : t('serviceCount', { count: appointment?.serviceIds.length ?? 0 });

  return (
    <Screen padded={false} style={{ backgroundColor: colors.ink }}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.successHalo}>
          <View style={styles.successMark}>
            <Text style={styles.successCheck}>✓</Text>
          </View>
        </View>
        <Text style={styles.title}>{t('youAreBooked')}</Text>
        <Text style={styles.subtitle}>{t('bookingConfirmedSubtitle')}</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{capitalize(serviceLabel)}</Text>
          <Text style={styles.summaryMeta}>
            {t('withBarber', { barber: barber?.displayName ?? t('yourBarber') })}
            {appointment
              ? ` · ${formatDateLong(appointment.startAt)} · ${formatTimeOfDay(appointment.startAt)}`
              : ''}
          </Text>
          <View style={styles.summaryDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.salonName}>Rêve Hair Salon</Text>
            <Text style={styles.totalValue}>€{formatPrice(totalCents)}</Text>
          </View>
        </View>
      </View>

      <BottomBar bordered={false} style={{ backgroundColor: colors.ink }}>
        <Button title={t('viewAppointment')} variant="accent" onPress={viewAppointment} />
        <Button
          title={t('addToCalendar')}
          variant="secondary"
          style={styles.calendarButton}
          textStyle={{ color: colors.card, fontWeight: font.weight.medium }}
          onPress={addToCalendar}
          disabled={!appointment}
        />
      </BottomBar>
    </Screen>
  );
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

function toGcalDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHalo: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(31, 145, 98, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successMark: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: '#1f9162',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheck: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: font.weight.bold,
  },
  title: {
    fontSize: 28,
    fontWeight: font.weight.semibold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#B1B1B9',
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
    maxWidth: 280,
  },
  summaryCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 16,
    padding: 18,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: font.weight.semibold,
    color: '#fff',
  },
  summaryMeta: {
    fontSize: 13,
    color: '#B1B1B9',
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    marginVertical: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  salonName: {
    fontSize: 13,
    color: '#B1B1B9',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: font.weight.semibold,
    color: colors.accent,
  },
  calendarButton: {
    marginTop: spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
});
