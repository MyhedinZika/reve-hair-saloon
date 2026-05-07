import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  parseDateString,
  todayDateString,
} from '@salon/shared';
import { BodyText, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { formatDateShort } from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'SelectDate'>;

export function SelectDateScreen({ navigation, route }: Props): React.JSX.Element {
  const { barberId, serviceIds } = route.params;
  const [horizonDays, setHorizonDays] = useState(DEFAULT_BOOKING_HORIZON_DAYS);

  useEffect(() => {
    stores.getSettings().then((s) => {
      if (s) setHorizonDays(s.bookingHorizonDays);
    });
  }, []);

  const dates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < horizonDays; i++) {
      out.push(addDaysToDateString(today, i));
    }
    return out;
  }, [horizonDays]);

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Select date</Heading>
      <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}>
        {dates.map((date) => {
          const { year, month, day } = parseDateString(date);
          return (
            <Pressable
              key={date}
              onPress={() =>
                navigation.navigate('SelectTime', { barberId, serviceIds, date })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                {formatDateShort(year, month, day)}
              </BodyText>
              <MutedText>{date}</MutedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
