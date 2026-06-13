import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, AppointmentStatus } from '@salon/shared';
import {
  BodyText,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { AdminAppointmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminAppointmentsStackParamList, 'AppointmentsList'>;

type Filter = 'upcoming' | 'past' | 'cancelled';

const FILTER_LABEL: Record<Filter, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  cancelled: 'Cancelled',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelledByClient: 'Cancelled (client)',
  cancelledByAdmin: 'Cancelled (admin)',
  noShow: 'No-show',
};

export function AdminAppointmentsScreen({ navigation }: Props): React.JSX.Element {
  const [items, setItems] = useState<AppointmentDoc[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');

  useEffect(() => {
    const unsub = stores.watchAllAppointments(setItems);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (filter === 'upcoming') {
      return items.filter((a) => a.status === 'confirmed' && a.startAt > now)
        .sort((a, b) => a.startAt - b.startAt);
    }
    if (filter === 'past') {
      return items.filter((a) => a.status === 'completed' || (a.status === 'confirmed' && a.endAt < now))
        .sort((a, b) => b.startAt - a.startAt);
    }
    return items
      .filter((a) =>
        a.status === 'cancelledByClient' || a.status === 'cancelledByAdmin' || a.status === 'noShow',
      )
      .sort((a, b) => b.startAt - a.startAt);
  }, [items, filter]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        {(['upcoming', 'past', 'cancelled'] as Filter[]).map((f) => (
          <Pill key={f} label={FILTER_LABEL[f]} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.sm }}>
        {filtered.length === 0 ? <MutedText>None.</MutedText> : null}
        {filtered.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: a.id })}
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
                {formatDateLong(a.startAt)}
              </BodyText>
              <MutedText>{formatTimeOfDay(a.startAt)}</MutedText>
            </View>
            <MutedText style={{ marginTop: spacing.xs }}>
              {STATUS_LABEL[a.status]} · {a.guestClient ? a.guestClient.name : 'Registered client'}
            </MutedText>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
