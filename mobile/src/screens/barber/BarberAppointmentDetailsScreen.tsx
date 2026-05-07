import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, ServiceDoc } from '@salon/shared';
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
import type { BarberStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarberStackParamList, 'AppointmentDetails'>;

export function BarberAppointmentDetailsScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    stores.listServices().then((all) => {
      if (appointment) {
        setServices(all.filter((s) => appointment.serviceIds.includes(s.id)));
      }
    });
  }, [appointment]);

  const setStatus = async (status: 'completed' | 'noShow'): Promise<void> => {
    setBusy(true);
    try {
      await api.markStatus({ appointmentId, status });
    } catch (err) {
      Alert.alert('Could not update', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const cancel = (): void => {
    Alert.alert('Cancel appointment?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.cancelAppointment({ appointmentId });
            navigation.goBack();
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof Error ? err.message : 'Unknown');
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
            <MutedText>Client</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {appointment.guestClient ? appointment.guestClient.name : 'Registered client'}
            </BodyText>
          </View>
          {appointment.guestClient?.phone ? (
            <>
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <MutedText>Phone</MutedText>
                <BodyText>{appointment.guestClient.phone}</BodyText>
              </View>
            </>
          ) : null}
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
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>Status</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>{appointment.status}</BodyText>
          </View>
        </Card>

        {appointment.status === 'confirmed' && appointment.clientId ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="Message client"
              variant="secondary"
              onPress={() => navigation.navigate('Chat', { appointmentId })}
            />
          </View>
        ) : null}

        {appointment.status === 'confirmed' ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <Button
              title="Mark as completed"
              loading={busy}
              onPress={() => void setStatus('completed')}
            />
            <Button
              title="Mark as no-show"
              variant="secondary"
              loading={busy}
              onPress={() => void setStatus('noShow')}
            />
            <Button title="Cancel appointment" variant="danger" loading={busy} onPress={cancel} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
