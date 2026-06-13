import { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { AppointmentDoc, BarberDoc } from '@salon/shared';
import { BodyText, Button, Card, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { ClientTabParamList } from '../../navigation/types';

type Props = BottomTabScreenProps<ClientTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [upcoming, setUpcoming] = useState<AppointmentDoc | null>(null);

  useEffect(() => {
    stores.listBarbers().then(setBarbers).catch(() => setBarbers([]));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const unsub = stores.watchClientAppointments(profile.uid, (docs) => {
      const now = Date.now();
      const next = docs
        .filter((d) => d.status === 'confirmed' && d.startAt > now)
        .sort((a, b) => a.startAt - b.startAt)[0];
      setUpcoming(next ?? null);
    });
    return () => unsub();
  }, [profile]);

  const startBooking = (): void => {
    navigation.navigate('Booking', { screen: 'Book' });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.xl }}>
          <Heading level={1}>Book your{'\n'}next perfect cut</Heading>
          <MutedText style={{ marginTop: spacing.sm }}>
            Hello{profile ? `, ${profile.displayName.split(' ')[0]}` : ''}.
          </MutedText>
        </View>

        <Button title="Book appointment" onPress={startBooking} />

        {upcoming ? (
          <View style={{ marginTop: spacing.xl }}>
            <Heading level={3} style={{ marginBottom: spacing.md }}>Upcoming</Heading>
            <Card>
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                {formatDateLong(upcoming.startAt)} · {formatTimeOfDay(upcoming.startAt)}
              </BodyText>
              <MutedText style={{ marginTop: spacing.xs }}>
                {upcoming.serviceIds.length} service(s)
              </MutedText>
            </Card>
          </View>
        ) : null}

        {barbers.length > 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <Heading level={3} style={{ marginBottom: spacing.md }}>Our barbers</Heading>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {barbers.map((b) => (
                <View
                  key={b.id}
                  style={{
                    width: 120,
                    backgroundColor: colors.card,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.md,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.bgAlt,
                      marginBottom: spacing.sm,
                      overflow: 'hidden',
                    }}
                  >
                    {b.avatarUrl ? (
                      <Image source={{ uri: b.avatarUrl }} style={{ width: 64, height: 64 }} />
                    ) : null}
                  </View>
                  <BodyText style={{ fontWeight: font.weight.semibold, textAlign: 'center' }}>
                    {b.displayName}
                  </BodyText>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
