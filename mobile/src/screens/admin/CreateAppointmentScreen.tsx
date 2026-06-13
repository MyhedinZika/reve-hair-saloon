import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  todayDateString,
  type BarberDoc,
  type CreateAppointmentInput,
  type ServiceDoc,
} from '@salon/shared';
import {
  BodyText,
  Button,
  Heading,
  IconButton,
  Input,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { formatDuration, formatPrice, formatTimeOfDay } from '../../util/format';
import type { AdminManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminManageStackParamList, 'CreateAppointment'>;
type Mode = 'registered' | 'guest';

export function CreateAppointmentScreen({ navigation }: Props): React.JSX.Element {
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(todayDateString());
  const [slots, setSlots] = useState<number[] | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('guest');
  const [clientUid, setClientUid] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    stores.listBarbers().then(setBarbers);
    stores.listServices().then(setServices);
  }, []);

  const totalDuration = useMemo(
    () =>
      services
        .filter((s) => selectedServices.has(s.id))
        .reduce((acc, s) => acc + s.durationMinutes, 0),
    [services, selectedServices],
  );

  useEffect(() => {
    if (!barberId || totalDuration === 0) {
      setSlots(null);
      setStartAt(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    api
      .getAvailableSlots({ barberId, date, serviceDurationMinutes: totalDuration })
      .then((r) => {
        if (!cancelled) setSlots(r.slots);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [barberId, date, totalDuration]);

  const dates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < DEFAULT_BOOKING_HORIZON_DAYS; i++) {
      out.push(addDaysToDateString(today, i));
    }
    return out;
  }, []);

  const submit = async (): Promise<void> => {
    if (!barberId || selectedServices.size === 0 || startAt === null) {
      Alert.alert('Incomplete', 'Pick a barber, services, and a time slot.');
      return;
    }
    const input: CreateAppointmentInput = {
      barberId,
      serviceIds: Array.from(selectedServices),
      startAt,
    };
    if (mode === 'registered') {
      if (!clientUid.trim()) {
        Alert.alert('Missing client', 'Enter the client uid.');
        return;
      }
      input.onBehalfOfClientId = clientUid.trim();
    } else {
      if (!guestName.trim() || !guestPhone.trim()) {
        Alert.alert('Missing guest details', 'Enter name and phone.');
        return;
      }
      input.guestClient = { name: guestName.trim(), phone: guestPhone.trim() };
    }
    setBusy(true);
    try {
      await api.createAppointment(input);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not create', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <IconButton label="Back" onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
        </IconButton>
        <View>
          <Heading level={3}>New appointment</Heading>
          <MutedText>Book on behalf of a client</MutedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MutedText>Barber</MutedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {barbers.map((b) => (
            <Pill
              key={b.id}
              label={b.displayName}
              selected={b.id === barberId}
              selectedTone="accent"
              onPress={() => setBarberId(b.id)}
            />
          ))}
        </View>

        <MutedText>Services</MutedText>
        <View style={{ gap: spacing.sm }}>
          {services
            .filter((s) => !barberId || barbers.find((b) => b.id === barberId)?.serviceIds.includes(s.id))
            .map((s) => {
              const isSelected = selectedServices.has(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    const next = new Set(selectedServices);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    setSelectedServices(next);
                  }}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.accent : colors.border,
                  }}
                >
                  <BodyText
                    style={{
                      color: colors.ink,
                      fontWeight: font.weight.medium,
                    }}
                  >
                    {s.name} · {formatDuration(s.durationMinutes)}
                  </BodyText>
                  <BodyText
                    style={{
                      color: colors.ink,
                    }}
                  >
                    ${formatPrice(s.priceCents)}
                  </BodyText>
                </Pressable>
              );
            })}
        </View>

        <MutedText>Date</MutedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {dates.map((d) => (
            <Pill
              key={d}
              label={d.slice(5)}
              selected={d === date}
              selectedTone="accent"
              onPress={() => setDate(d)}
            />
          ))}
        </ScrollView>

        <MutedText>Time</MutedText>
        {slots === null ? (
          <MutedText>Pick a barber and services first.</MutedText>
        ) : slots.length === 0 ? (
          <MutedText>No availability on this date.</MutedText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {slots.map((s) => (
            <Pill
              key={s}
              label={formatTimeOfDay(s)}
              selected={startAt === s}
              selectedTone="accent"
              onPress={() => setStartAt(s)}
            />
            ))}
          </View>
        )}

        <MutedText>Client</MutedText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pill
            label="Guest"
            selected={mode === 'guest'}
            selectedTone="accent"
            onPress={() => setMode('guest')}
          />
          <Pill
            label="Registered"
            selected={mode === 'registered'}
            selectedTone="accent"
            onPress={() => setMode('registered')}
          />
        </View>

        {mode === 'registered' ? (
          <Input label="Client uid" value={clientUid} onChangeText={setClientUid} autoCapitalize="none" />
        ) : (
          <View>
            <Input label="Guest name" value={guestName} onChangeText={setGuestName} />
            <Input
              label="Guest phone"
              value={guestPhone}
              onChangeText={setGuestPhone}
              keyboardType="phone-pad"
            />
          </View>
        )}

        <MutedText>
          Admin bookings are auto-confirmed and bypass the 2-per-day client limit.
        </MutedText>
        <Button title="Create appointment" onPress={submit} loading={busy} />
      </ScrollView>
    </Screen>
  );
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
    gap: spacing.md,
  },
});
