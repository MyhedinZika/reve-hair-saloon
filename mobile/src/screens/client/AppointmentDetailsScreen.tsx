import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  type AppointmentDoc,
  type BarberDoc,
  type ServiceDoc,
} from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Divider,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { font, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import {
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTimeOfDay,
} from '../../util/format';
import type { ClientStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ClientStackParamList, 'AppointmentDetails'>;

export function AppointmentDetailsScreen({ navigation, route }: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [barber, setBarber] = useState<BarberDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [windowHours, setWindowHours] = useState(DEFAULT_CANCELLATION_WINDOW_HOURS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    Promise.all([stores.listBarbers(), stores.listServices(), stores.getSettings()]).then(
      ([bs, ss, settings]) => {
        if (settings) setWindowHours(settings.cancellationWindowHours);
        if (appointment) {
          setBarber(bs.find((b) => b.id === appointment.barberId) ?? null);
          setServices(ss.filter((s) => appointment.serviceIds.includes(s.id)));
        }
      },
    );
  }, [appointment]);

  const canCancel = useMemo(() => {
    if (!appointment) return false;
    if (appointment.status !== 'confirmed') return false;
    return appointment.startAt - Date.now() > windowHours * 60 * 60 * 1000;
  }, [appointment, windowHours]);

  const handleCancel = (): void => {
    if (!appointment) return;
    Alert.alert('Cancel appointment?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.cancelAppointment({ appointmentId });
            navigation.goBack();
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!appointment) {
    return (
      <Screen>
        <BodyText>Loading…</BodyText>
      </Screen>
    );
  }

  const totalCents = services.reduce((acc, s) => acc + s.priceCents, 0);
  const totalMinutes = services.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Appointment</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>Barber</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {barber?.displayName ?? '...'}
            </BodyText>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>When</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {formatDateLong(appointment.startAt)} · {formatTimeOfDay(appointment.startAt)}
            </BodyText>
          </View>
          <Divider />
          <MutedText style={{ marginBottom: spacing.sm }}>Services</MutedText>
          {services.map((s) => (
            <View
              key={s.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <BodyText>{s.name}</BodyText>
              <BodyText>${formatPrice(s.priceCents)}</BodyText>
            </View>
          ))}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <BodyText style={{ fontWeight: font.weight.semibold }}>Total</BodyText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              ${formatPrice(totalCents)} · {formatDuration(totalMinutes)}
            </BodyText>
          </View>
        </Card>

        {appointment.status === 'confirmed' ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <Button
              title="Message barber"
              variant="secondary"
              onPress={() => navigation.navigate('Chat', { appointmentId })}
            />
            <Button
              title="Reschedule"
              variant="secondary"
              disabled={!canCancel}
              onPress={() => navigation.navigate('Reschedule', { appointmentId })}
            />
            <Button
              title="Cancel appointment"
              variant="danger"
              disabled={!canCancel || busy}
              loading={busy}
              onPress={handleCancel}
            />
            {!canCancel ? (
              <MutedText style={{ textAlign: 'center' }}>
                Cancellation closes {windowHours}h before the appointment.
              </MutedText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
