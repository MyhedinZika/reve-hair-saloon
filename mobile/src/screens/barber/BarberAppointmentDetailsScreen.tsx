import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import type { AppointmentDoc, ServiceDoc, UserDoc } from '@salon/shared';
import { firestore } from '../../config/firebase';
import {
  BodyText,
  BottomBar,
  Button,
  Card,
  Divider,
  Heading,
  IconButton,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, spacing } from '../../theme/tokens';
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
  const [client, setClient] = useState<UserDoc | null>(null);
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
    <Screen padded={false}>
      <View style={styles.header}>
        <IconButton label="Back" onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
        </IconButton>
        <View>
          <Heading level={3}>Appointment</Heading>
          <MutedText>Next up - {formatTimeOfDay(appointment.startAt)}</MutedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

      </ScrollView>
      {appointment.status === 'confirmed' ? (
        <BottomBar>
          <Button
            title="Mark completed"
            loading={busy}
            onPress={() => void setStatus('completed')}
          />
          <Button
            title="Mark as no-show"
            variant="secondary"
            style={{ marginTop: spacing.sm }}
            loading={busy}
            onPress={() => void setStatus('noShow')}
          />
          <Button
            title="Cancel appointment"
            variant="danger"
            style={{ marginTop: spacing.sm }}
            loading={busy}
            onPress={cancel}
          />
        </BottomBar>
      ) : null}
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

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
