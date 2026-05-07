import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ServiceDoc } from '@salon/shared';
import { BodyText, Button, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { formatTimeOfDay, formatDateLong } from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'SelectTime'>;

export function SelectTimeScreen({ navigation, route }: Props): React.JSX.Element {
  const { barberId, serviceIds, date } = route.params;
  const [slots, setSlots] = useState<number[] | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [nextSlot, setNextSlot] = useState<number | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const services: ServiceDoc[] = await stores.listServices();
        const totalMinutes = services
          .filter((s) => serviceIds.includes(s.id))
          .reduce((acc, s) => acc + s.durationMinutes, 0);
        if (cancelled) return;
        setDuration(totalMinutes);
        const result = await api.getAvailableSlots({
          barberId,
          date,
          serviceDurationMinutes: totalMinutes,
        });
        if (cancelled) return;
        setSlots(result.slots);

        if (result.slots.length === 0) {
          setLoadingNext(true);
          const next = await api.nextAvailable({
            barberId,
            fromDate: date,
            serviceDurationMinutes: totalMinutes,
          });
          if (cancelled) return;
          setNextDate(next.date);
          setNextSlot(next.slot);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load slots.');
      } finally {
        if (!cancelled) setLoadingNext(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barberId, date, serviceIds]);

  const proceed = (startAt: number): void => {
    navigation.navigate('Confirm', { barberId, serviceIds, startAt });
  };

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.xs }}>Select time</Heading>
      <MutedText style={{ marginBottom: spacing.lg }}>
        {formatDateLong(new Date(`${date}T12:00:00Z`).getTime())}
      </MutedText>

      {error ? <MutedText>{error}</MutedText> : null}

      {slots === null ? (
        <ActivityIndicator color={colors.ink} />
      ) : slots.length === 0 ? (
        <View style={{ paddingVertical: spacing.lg }}>
          <BodyText style={{ marginBottom: spacing.md }}>No availability on this date.</BodyText>
          {loadingNext ? (
            <ActivityIndicator color={colors.ink} />
          ) : nextDate && nextSlot !== null ? (
            <Button
              title={`Next available: ${formatDateLong(nextSlot)} at ${formatTimeOfDay(nextSlot)}`}
              variant="secondary"
              onPress={() => {
                if (nextSlot !== null) proceed(nextSlot);
              }}
            />
          ) : (
            <MutedText>No availability in the booking horizon.</MutedText>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            paddingBottom: spacing.xxl,
          }}
        >
          {slots.map((s) => (
            <Pressable
              key={s}
              onPress={() => proceed(s)}
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
      {duration > 0 ? (
        <MutedText style={{ marginTop: spacing.md }}>
          Total duration: {duration} min
        </MutedText>
      ) : null}
    </Screen>
  );
}
