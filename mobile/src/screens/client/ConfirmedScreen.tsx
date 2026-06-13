import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, BarberDoc, ServiceDoc } from '@salon/shared';
import {
  BodyText,
  BottomBar,
  Button,
  Card,
  Heading,
  MutedText,
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

  const goHome = (): void => {
    const parent = navigation.getParent();
    if (parent) {
      parent.goBack();
      return;
    }
    navigation.popToTop();
  };

  const serviceLabel =
    services.length > 0
      ? services.map((service) => service.name.toLowerCase()).join(' & ')
      : t('serviceCount', { count: appointment?.serviceIds.length ?? 0 });

  return (
    <Screen padded={false}>
      <View style={styles.content}>
        <View style={styles.successMark}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Heading level={2}>{t('youAreBooked')}</Heading>
        <MutedText style={styles.subtitle}>
          {t('bookingConfirmedSubtitle')}
        </MutedText>

        <Card style={styles.summaryCard}>
          <BodyText style={{ fontWeight: font.weight.semibold }}>
            {capitalize(serviceLabel)}
          </BodyText>
          <MutedText style={{ marginTop: spacing.xs }}>
            {t('withBarber', { barber: barber?.displayName ?? t('yourBarber') })}
            {appointment ? ` - ${formatDateLong(appointment.startAt)} - ${formatTimeOfDay(appointment.startAt)}` : ''}
          </MutedText>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <MutedText>Rêve Hair Salon</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              EUR {formatPrice(totalCents)}
            </BodyText>
          </View>
        </Card>
      </View>

      <BottomBar>
        <Button title={t('viewAppointment')} onPress={goHome} />
        <Button
          title={t('addToCalendar')}
          variant="secondary"
          style={{ marginTop: spacing.sm }}
          onPress={goHome}
        />
      </BottomBar>
    </Screen>
  );
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 84,
    alignItems: 'center',
  },
  successMark: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheck: {
    color: colors.success,
    fontSize: 42,
    fontWeight: font.weight.semibold,
    lineHeight: 48,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  summaryCard: {
    alignSelf: 'stretch',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
