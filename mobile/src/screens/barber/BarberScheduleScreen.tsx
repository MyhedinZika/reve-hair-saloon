import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc } from '@salon/shared';
import {
  BodyText,
  Button,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useMyBarber } from '../../hooks/useMyBarber';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { BarberStackParamList, BarberTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Schedule'>,
  NativeStackScreenProps<BarberStackParamList>
>;

export function BarberScheduleScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const barber = useMyBarber(profile?.uid ?? null);
  const [items, setItems] = useState<AppointmentDoc[]>([]);

  useEffect(() => {
    if (!barber) return;
    const unsub = stores.watchBarberAppointments(barber.id, setItems);
    return () => unsub();
  }, [barber]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return items
      .filter((a) => a.status === 'confirmed' && a.endAt > now)
      .sort((a, b) => a.startAt - b.startAt);
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentDoc[]>();
    for (const a of upcoming) {
      const key = formatDateLong(a.startAt);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [upcoming]);

  if (!barber) {
    return (
      <Screen>
        <Heading level={2}>My schedule</Heading>
        <MutedText style={{ marginTop: spacing.lg }}>
          Your barber profile hasn't been set up yet. Ask the admin.
        </MutedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>My schedule</Heading>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Button
          title="Hours"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ManageHours')}
        />
        <Button
          title="Breaks"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ManageBreaks')}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {grouped.length === 0 ? (
          <MutedText>No upcoming appointments.</MutedText>
        ) : null}
        {grouped.map(([day, list]) => (
          <View key={day} style={{ gap: spacing.sm }}>
            <MutedText style={{ marginTop: spacing.sm }}>{day}</MutedText>
            {list.map((a) => (
              <Pressable
                key={a.id}
                onPress={() =>
                  navigation.navigate('AppointmentDetails', { appointmentId: a.id })
                }
                style={({ pressed }) => ({
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <BodyText style={{ fontWeight: font.weight.semibold }}>
                    {formatTimeOfDay(a.startAt)} – {formatTimeOfDay(a.endAt)}
                  </BodyText>
                  <MutedText>
                    {a.guestClient ? a.guestClient.name : 'Client'}
                  </MutedText>
                </View>
                <MutedText style={{ marginTop: spacing.xs }}>
                  {a.serviceIds.length} service(s)
                </MutedText>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
