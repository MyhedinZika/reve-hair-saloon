import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, AppointmentStatus } from '@salon/shared';
import {
  BodyText,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { ClientStackParamList, ClientTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ClientTabParamList, 'Appointments'>,
  NativeStackScreenProps<ClientStackParamList>
>;

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelledByClient: 'Cancelled',
  cancelledByAdmin: 'Cancelled by salon',
  noShow: 'No-show',
};

export function AppointmentsScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppointmentDoc[]>([]);

  useEffect(() => {
    if (!profile) return;
    const unsub = stores.watchClientAppointments(profile.uid, setItems);
    return () => unsub();
  }, [profile]);

  const upcoming = items.filter((a) => a.status === 'confirmed').sort((a, b) => a.startAt - b.startAt);
  const past = items.filter((a) => a.status !== 'confirmed').sort((a, b) => b.startAt - a.startAt);

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>My appointments</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {upcoming.length === 0 && past.length === 0 ? (
          <MutedText>No appointments yet.</MutedText>
        ) : null}

        {upcoming.length > 0 ? (
          <MutedText style={{ marginTop: spacing.sm }}>Upcoming</MutedText>
        ) : null}
        {upcoming.map((a) => (
          <AppointmentRow
            key={a.id}
            appointment={a}
            onPress={() =>
              navigation.navigate('AppointmentDetails', { appointmentId: a.id })
            }
          />
        ))}

        {past.length > 0 ? (
          <MutedText style={{ marginTop: spacing.lg }}>Past</MutedText>
        ) : null}
        {past.map((a) => (
          <AppointmentRow
            key={a.id}
            appointment={a}
            onPress={() =>
              navigation.navigate('AppointmentDetails', { appointmentId: a.id })
            }
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

interface RowProps {
  appointment: AppointmentDoc;
  onPress: () => void;
}

function AppointmentRow({ appointment, onPress }: RowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
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
          {formatDateLong(appointment.startAt)}
        </BodyText>
        <MutedText>{formatTimeOfDay(appointment.startAt)}</MutedText>
      </View>
      <MutedText style={{ marginTop: spacing.xs }}>
        {STATUS_LABEL[appointment.status]} · {appointment.serviceIds.length} service(s)
      </MutedText>
    </Pressable>
  );
}
