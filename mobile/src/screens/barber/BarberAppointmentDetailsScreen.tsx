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
  Heading,
  IconButton,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { formatDuration, formatPrice, formatTimeOfDay } from '../../util/format';
import type { BarberStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarberStackParamList, 'AppointmentDetails'>;

const STATUS_LABEL: Record<AppointmentDoc['status'], string> = {
  confirmed: 'Confirmed',
  completed: 'Done',
  cancelledByClient: 'Cancelled',
  cancelledByAdmin: 'Cancelled',
  noShow: 'No-show',
};

export function BarberAppointmentDetailsScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [client, setClient] = useState<UserDoc | null>(null);
  const [pastVisits, setPastVisits] = useState<number | null>(null);
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
      setPastVisits(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'users', appointment.clientId!));
        if (cancelled) return;
        setClient((snap.data() as UserDoc | undefined) ?? null);
      } catch {
        if (!cancelled) setClient(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment?.clientId]);

  // Count past visits (completed appointments) for this client + barber pair.
  // Lightweight: filtered client-side from a small barber stream.
  useEffect(() => {
    if (!appointment?.clientId || !appointment?.barberId) {
      setPastVisits(null);
      return;
    }
    let cancelled = false;
    const unsub = stores.watchBarberAppointments(appointment.barberId, (rows) => {
      if (cancelled) return;
      const n = rows.filter(
        (a) => a.clientId === appointment.clientId && a.status === 'completed',
      ).length;
      setPastVisits(n);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [appointment?.clientId, appointment?.barberId]);

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

  if (!appointment) {
    return (
      <Screen>
        <BodyText>Loading…</BodyText>
      </Screen>
    );
  }

  const totalCents = services.reduce((acc, s) => acc + s.priceCents, 0);
  const totalMinutes = services.reduce((acc, s) => acc + s.durationMinutes, 0);

  const now = Date.now();
  const isActiveOrUpcoming =
    appointment.status === 'confirmed' && appointment.endAt > now;
  const nextUpLabel =
    appointment.status === 'completed'
      ? 'Done'
      : appointment.status === 'noShow'
        ? 'No-show'
        : appointment.status === 'cancelledByClient' || appointment.status === 'cancelledByAdmin'
          ? 'Cancelled'
          : `Next up · ${formatTimeOfDay(appointment.startAt)}`;
  const phone = phoneFor(appointment, client);
  const displayName = nameFor(appointment, client);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <IconButton label="Back" onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
        </IconButton>
        <Heading level={3}>Appointment</Heading>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <View style={styles.nextPill}>
            <Text style={styles.nextPillText}>{nextUpLabel}</Text>
          </View>
          <Text style={styles.refText}>
            #{appointment.id.slice(0, 6).toUpperCase()}
          </Text>
        </View>

        <Card style={styles.clientCard}>
          <Text style={styles.sectionLabel}>CLIENT</Text>
          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{initials(displayName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <BodyText style={{ fontWeight: font.weight.semibold }} numberOfLines={1}>
                {displayName}
              </BodyText>
              <MutedText style={{ fontSize: font.size.sm, marginTop: 2 }} numberOfLines={1}>
                {[phone, pastVisits !== null ? `${pastVisits} past visits` : null]
                  .filter(Boolean)
                  .join(' · ') || ' '}
              </MutedText>
            </View>
            {appointment.clientId ? (
              <Pressable
                onPress={() => navigation.navigate('Chat', { appointmentId })}
                style={styles.iconButton}
                hitSlop={6}
              >
                <Text style={styles.iconButtonText}>✉︎</Text>
              </Pressable>
            ) : null}
            {phone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${phone}`)}
                style={styles.iconButton}
                hitSlop={6}
              >
                <Text style={styles.iconButtonText}>☎︎</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        <Card style={styles.serviceCard}>
          <View style={styles.serviceHeaderRow}>
            <Text style={styles.clockIcon}>◷</Text>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {formatTimeOfDay(appointment.startAt)} – {formatTimeOfDay(appointment.endAt)} ·{' '}
              {formatDuration(totalMinutes || appointment.durationMinutes)}
            </BodyText>
          </View>
          {services.map((s) => (
            <View key={s.id} style={styles.serviceRow}>
              <MutedText>{s.name}</MutedText>
              <BodyText style={{ fontWeight: font.weight.medium }}>
                €{formatPrice(s.priceCents)}
              </BodyText>
            </View>
          ))}
          <View style={styles.cardDivider} />
          <View style={styles.totalRow}>
            <BodyText style={{ fontWeight: font.weight.semibold }}>Total</BodyText>
            <BodyText
              style={{ fontWeight: font.weight.semibold, fontSize: font.size.xl }}
            >
              €{formatPrice(totalCents)}
            </BodyText>
          </View>
        </Card>

        {!isActiveOrUpcoming ? (
          <Card style={{ marginTop: spacing.md }}>
            <MutedText style={{ fontSize: font.size.sm }}>
              Status: {STATUS_LABEL[appointment.status]}
            </MutedText>
          </Card>
        ) : null}
      </ScrollView>

      {isActiveOrUpcoming ? (
        <BottomBar>
          <Pressable
            onPress={() => void setStatus('completed')}
            disabled={busy}
            style={({ pressed }) => [
              styles.completedButton,
              pressed || busy ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.completedButtonText}>✓ Mark completed</Text>
          </Pressable>
          <Pressable
            onPress={() => void setStatus('noShow')}
            disabled={busy}
            style={({ pressed }) => [
              styles.noShowButton,
              pressed || busy ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.noShowButtonText}>Mark as no-show</Text>
          </Pressable>
        </BottomBar>
      ) : null}
    </Screen>
  );
}

function nameFor(appointment: AppointmentDoc, user: UserDoc | null): string {
  if (appointment.guestClient) return appointment.guestClient.name;
  return user?.displayName?.trim() || user?.email || 'Registered client';
}

function phoneFor(appointment: AppointmentDoc, user: UserDoc | null): string | null {
  if (appointment.guestClient?.phone) return appointment.guestClient.phone;
  return user?.phone ?? null;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase();
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextPill: {
    backgroundColor: '#FDF6EC',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  nextPillText: {
    fontSize: 12,
    fontWeight: font.weight.semibold,
    color: '#AA630D',
  },
  refText: {
    fontSize: 13,
    color: colors.muted,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  clientCard: {
    gap: spacing.sm,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  clientAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: font.weight.semibold,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 18,
    color: colors.ink,
  },
  serviceCard: {
    gap: spacing.sm,
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 4,
  },
  clockIcon: {
    color: colors.accent,
    fontSize: 18,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  completedButton: {
    height: 50,
    backgroundColor: '#1F9162',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  completedButtonText: {
    color: colors.card,
    fontWeight: font.weight.semibold,
    fontSize: font.size.lg,
  },
  noShowButton: {
    height: 50,
    backgroundColor: colors.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noShowButtonText: {
    color: '#A53E2F',
    fontWeight: font.weight.semibold,
    fontSize: font.size.lg,
  },
});
