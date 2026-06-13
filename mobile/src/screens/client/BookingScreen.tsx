import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  dayOfWeekFromDateString,
  todayDateString,
  type BarberDoc,
  type ServiceDoc,
} from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Divider,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import {
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTimeOfDay,
} from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'Book'>;

const DOW_SHORT: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function BookingScreen({ navigation }: Props): React.JSX.Element {
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(todayDateString());
  const [slots, setSlots] = useState<number[] | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stores.listBarbers().then((bs) => setBarbers(bs.filter((b) => b.active)));
    stores.listServices().then((ss) => setServices(ss.filter((s) => s.active)));
  }, []);

  const visibleServices = useMemo(() => {
    if (!barberId) return [];
    const b = barbers.find((x) => x.id === barberId);
    if (!b) return [];
    return services.filter((s) => b.serviceIds.includes(s.id));
  }, [barbers, services, barberId]);

  const totalMinutes = useMemo(
    () =>
      services
        .filter((s) => selectedServices.has(s.id))
        .reduce((acc, s) => acc + s.durationMinutes, 0),
    [services, selectedServices],
  );

  const totalCents = useMemo(
    () =>
      services
        .filter((s) => selectedServices.has(s.id))
        .reduce((acc, s) => acc + s.priceCents, 0),
    [services, selectedServices],
  );

  const dates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < DEFAULT_BOOKING_HORIZON_DAYS; i++) {
      out.push(addDaysToDateString(today, i));
    }
    return out;
  }, []);

  useEffect(() => {
    if (!barberId || totalMinutes === 0) {
      setSlots(null);
      setStartAt(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    setStartAt(null);
    api
      .getAvailableSlots({ barberId, date, serviceDurationMinutes: totalMinutes })
      .then((r) => {
        if (!cancelled) setSlots(r.slots);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [barberId, date, totalMinutes]);

  const toggleService = (id: string): void => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStartAt(null);
  };

  const onPickBarber = (id: string): void => {
    setBarberId(id);
    setSelectedServices(new Set());
    setStartAt(null);
  };

  const onPickDate = (d: string): void => {
    setDate(d);
    setStartAt(null);
  };

  const canBook =
    !!barberId && selectedServices.size > 0 && startAt !== null && !submitting;

  const book = async (): Promise<void> => {
    if (!barberId || selectedServices.size === 0 || startAt === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const { appointmentId } = await api.createAppointment({
        barberId,
        serviceIds: Array.from(selectedServices),
        startAt,
      });
      navigation.replace('Confirmed', { appointmentId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.lg }}>
        <Section label="Barber">
          {barbers.length === 0 ? (
            <MutedText>No barbers available.</MutedText>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {barbers.map((b) => (
                <Pill
                  key={b.id}
                  label={b.displayName}
                  selected={b.id === barberId}
                  onPress={() => onPickBarber(b.id)}
                />
              ))}
            </View>
          )}
        </Section>

        {barberId ? (
          <Section label="Services">
            {visibleServices.length === 0 ? (
              <MutedText>This barber has no services.</MutedText>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {visibleServices.map((s) => {
                  const isSelected = selectedServices.has(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => toggleService(s.id)}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        padding: spacing.md,
                        borderRadius: radius.md,
                        backgroundColor: isSelected ? colors.ink : colors.card,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.ink : colors.border,
                      }}
                    >
                      <BodyText
                        style={{
                          color: isSelected ? colors.inkOnAccent : colors.ink,
                          fontWeight: font.weight.medium,
                        }}
                      >
                        {s.name} · {formatDuration(s.durationMinutes)}
                      </BodyText>
                      <BodyText
                        style={{ color: isSelected ? colors.inkOnAccent : colors.ink }}
                      >
                        ${formatPrice(s.priceCents)}
                      </BodyText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>
        ) : null}

        {barberId && selectedServices.size > 0 ? (
          <Section label="Date">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            >
              {dates.map((d) => (
                <Pill
                  key={d}
                  label={`${DOW_SHORT[dayOfWeekFromDateString(d)]} ${d.slice(8)}`}
                  selected={d === date}
                  onPress={() => onPickDate(d)}
                />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {barberId && selectedServices.size > 0 ? (
          <Section label="Time">
            {slots === null ? (
              <ActivityIndicator color={colors.ink} />
            ) : slots.length === 0 ? (
              <MutedText>No availability on this date.</MutedText>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {slots.map((s) => {
                  const isSelected = startAt === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStartAt(s)}
                      style={{
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderRadius: radius.pill,
                        backgroundColor: isSelected ? colors.ink : colors.card,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.ink : colors.border,
                      }}
                    >
                      <BodyText
                        style={{
                          color: isSelected ? colors.inkOnAccent : colors.ink,
                          fontWeight: font.weight.semibold,
                        }}
                      >
                        {formatTimeOfDay(s)}
                      </BodyText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>
        ) : null}

        {startAt !== null ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <MutedText>When</MutedText>
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                {formatDateLong(startAt)} · {formatTimeOfDay(startAt)}
              </BodyText>
            </View>
            <Divider />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <BodyText style={{ fontWeight: font.weight.semibold }}>Total</BodyText>
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                ${formatPrice(totalCents)} · {formatDuration(totalMinutes)}
              </BodyText>
            </View>
          </Card>
        ) : null}

        {error ? (
          <BodyText style={{ color: colors.danger }}>{error}</BodyText>
        ) : null}

        <Button
          title="Book appointment"
          loading={submitting}
          disabled={!canBook}
          onPress={book}
        />
      </ScrollView>
    </Screen>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps): React.JSX.Element {
  return (
    <View style={{ gap: spacing.sm }}>
      <MutedText style={{ fontWeight: font.weight.semibold }}>{label}</MutedText>
      {children}
    </View>
  );
}
