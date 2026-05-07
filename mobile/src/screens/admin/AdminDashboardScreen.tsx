import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  endOfDayUtcMs,
  startOfDayUtcMs,
  todayDateString,
  type AppointmentDoc,
} from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { font, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Dashboard'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AdminDashboardScreen({ navigation }: Props): React.JSX.Element {
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);

  useEffect(() => {
    const unsub = stores.watchAllAppointments(setAppointments);
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const today = todayDateString();
    const dayStart = startOfDayUtcMs(today);
    const dayEnd = endOfDayUtcMs(today);
    const todayAppts = appointments.filter((a) => a.startAt >= dayStart && a.startAt < dayEnd);
    const upcoming = appointments.filter((a) => a.status === 'confirmed' && a.startAt > Date.now());
    const cancelled = appointments.filter(
      (a) => a.status === 'cancelledByClient' || a.status === 'cancelledByAdmin',
    );
    return {
      todayCount: todayAppts.length,
      upcomingCount: upcoming.length,
      cancelledCount: cancelled.length,
    };
  }, [appointments]);

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Dashboard</Heading>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatCard label="Today" value={stats.todayCount} />
          <StatCard label="Upcoming" value={stats.upcomingCount} />
          <StatCard label="Cancelled" value={stats.cancelledCount} />
        </View>

        <Card style={{ gap: spacing.md }}>
          <Heading level={3}>Quick actions</Heading>
          <Button
            title="New appointment"
            onPress={() => navigation.navigate('CreateAppointment')}
          />
          <Button
            title="Manage barbers"
            variant="secondary"
            onPress={() => navigation.navigate('ManageBarbers')}
          />
          <Button
            title="Manage services"
            variant="secondary"
            onPress={() => navigation.navigate('ManageServices')}
          />
          <Button
            title="Salon settings"
            variant="secondary"
            onPress={() => navigation.navigate('ManageSettings')}
          />
          <Button
            title="Blocked users"
            variant="secondary"
            onPress={() => navigation.navigate('ManageBlocked')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps): React.JSX.Element {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.lg }}>
      <BodyText style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold }}>
        {value}
      </BodyText>
      <MutedText>{label}</MutedText>
    </Card>
  );
}
