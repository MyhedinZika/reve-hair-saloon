import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  parseDateString,
  todayDateString,
  type AppointmentDoc,
  type ServiceDoc,
} from '@salon/shared';
import { BodyText, Button, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { formatDateShort, formatTimeOfDay } from '../../util/format';
import type { ClientStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ClientStackParamList, 'Reschedule'>;

export function RescheduleScreen({ navigation, route }: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [horizonDays, setHorizonDays] = useState(DEFAULT_BOOKING_HORIZON_DAYS);
  const [date, setDate] = useState<string>(todayDateString());
  const [slots, setSlots] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    Promise.all([stores.listServices(), stores.getSettings()]).then(([ss, settings]) => {
      setServices(ss);
      if (settings) setHorizonDays(settings.bookingHorizonDays);
    });
  }, []);

  const totalDuration = useMemo(() => {
    if (!appointment) return 0;
    return services
      .filter((s) => appointment.serviceIds.includes(s.id))
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  }, [appointment, services]);

  useEffect(() => {
    if (!appointment || totalDuration === 0) return;
    let cancelled = false;
    setSlots(null);
    api
      .getAvailableSlots({
        barberId: appointment.barberId,
        date,
        serviceDurationMinutes: totalDuration,
      })
      .then((r) => {
        if (!cancelled) setSlots(r.slots);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [appointment, date, totalDuration]);

  const dates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < horizonDays; i++) out.push(addDaysToDateString(today, i));
    return out;
  }, [horizonDays]);

  const confirm = (newStartAt: number): void => {
    Alert.alert('Reschedule?', 'This will move your appointment to the new time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reschedule',
        onPress: async () => {
          setBusy(true);
          try {
            await api.rescheduleAppointment({ appointmentId, newStartAt });
            navigation.goBack();
          } catch (err) {
            Alert.alert(
              'Could not reschedule',
              err instanceof Error ? err.message : 'Unknown error',
            );
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

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Reschedule</Heading>

      <MutedText>Pick a new date</MutedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
      >
        {dates.map((d) => {
          const { year, month, day } = parseDateString(d);
          const selected = d === date;
          return (
            <Pressable
              key={d}
              onPress={() => setDate(d)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: selected ? colors.ink : colors.card,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.border,
              }}
            >
              <BodyText
                style={{
                  color: selected ? colors.inkOnAccent : colors.ink,
                  fontWeight: font.weight.medium,
                }}
              >
                {formatDateShort(year, month, day)}
              </BodyText>
            </Pressable>
          );
        })}
      </ScrollView>

      <MutedText style={{ marginTop: spacing.lg }}>Pick a new time</MutedText>
      {slots === null ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.md }} />
      ) : slots.length === 0 ? (
        <MutedText style={{ marginTop: spacing.md }}>No availability on this date.</MutedText>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            paddingVertical: spacing.md,
          }}
        >
          {slots.map((s) => (
            <Pressable
              key={s}
              onPress={() => confirm(s)}
              disabled={busy}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                {formatTimeOfDay(s)}
              </BodyText>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {busy ? (
        <View style={{ position: 'absolute', bottom: spacing.lg, left: 0, right: 0 }}>
          <Button title="Working…" loading onPress={() => undefined} />
        </View>
      ) : null}
    </Screen>
  );
}
