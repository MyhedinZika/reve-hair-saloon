import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import type { AppointmentDoc, BarberDoc, ServiceDoc, UserDoc } from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Divider,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { firestore } from '../../config/firebase';
import {
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTimeOfDay,
} from '../../util/format';
type AppointmentDetailsParamList = {
  AppointmentDetails: { appointmentId: string };
  Chat: { appointmentId: string };
};

type Props = NativeStackScreenProps<AppointmentDetailsParamList, 'AppointmentDetails'>;

export function AdminAppointmentDetailsScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [barber, setBarber] = useState<BarberDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [client, setClient] = useState<UserDoc | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    if (!appointment) return;
    Promise.all([stores.listBarbers(), stores.listServices()]).then(([bs, ss]) => {
      setBarber(bs.find((b) => b.id === appointment.barberId) ?? null);
      setServices(ss.filter((s) => appointment.serviceIds.includes(s.id)));
    });
  }, [appointment]);

  useEffect(() => {
    if (!appointment?.clientId) {
      setClient(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(firestore, 'users', appointment.clientId))
      .then((snap) => {
        if (cancelled) return;
        setClient((snap.data() as UserDoc | undefined) ?? null);
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appointment?.clientId]);

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
    Alert.alert('Cancel appointment?', 'Admin cancellation bypasses the 1-hour rule.', [
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
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>Client</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {clientName(appointment, client)}
            </BodyText>
          </View>
          {clientPhone(appointment, client) ? (
            <>
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <MutedText>Phone</MutedText>
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${clientPhone(appointment, client)}`)}
                >
                  <BodyText style={{ color: colors.accent, fontWeight: font.weight.semibold }}>
                    {clientPhone(appointment, client)}
                  </BodyText>
                </Pressable>
              </View>
            </>
          ) : null}
          {client?.email ? (
            <>
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <MutedText>Email</MutedText>
                <Pressable onPress={() => void Linking.openURL(`mailto:${client.email}`)}>
                  <BodyText style={{ color: colors.accent, fontWeight: font.weight.semibold }}>
                    {client.email}
                  </BodyText>
                </Pressable>
              </View>
            </>
          ) : null}
          <Divider />
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
              <BodyText>€{formatPrice(s.priceCents)}</BodyText>
            </View>
          ))}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <BodyText style={{ fontWeight: font.weight.semibold }}>Total</BodyText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              €{formatPrice(totalCents)} · {formatDuration(totalMinutes)}
            </BodyText>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>Status</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>{appointment.status}</BodyText>
          </View>
        </Card>

        {appointment.status === 'confirmed' ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {appointment.clientId ? (
              <Button
                title="Open chat"
                variant="secondary"
                onPress={() => navigation.navigate('Chat', { appointmentId })}
              />
            ) : null}
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

function clientName(appointment: AppointmentDoc, user: UserDoc | null): string {
  if (appointment.guestClient) return appointment.guestClient.name;
  return user?.displayName?.trim() || user?.email || 'Registered client';
}

function clientPhone(appointment: AppointmentDoc, user: UserDoc | null): string | null {
  if (appointment.guestClient?.phone) return appointment.guestClient.phone;
  return user?.phone ?? null;
}
