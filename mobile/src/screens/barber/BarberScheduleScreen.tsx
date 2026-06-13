import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { useI18n } from '../../i18n/I18nContext';
import { useMyBarber } from '../../hooks/useMyBarber';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { BarberStackParamList, BarberTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Schedule'>,
  NativeStackScreenProps<BarberStackParamList>
>;

export function BarberScheduleScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const { t } = useI18n();
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
      <Screen padded={false}>
        <View style={styles.header}>
          <Heading level={2}>{t('schedule')}</Heading>
          <MutedText>{t('barberProfileMissing')}</MutedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Heading level={2}>{t('schedule')}</Heading>
        <MutedText>{barber.displayName}</MutedText>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
        <Button
          title={t('hours')}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ManageHours')}
        />
        <Button
          title={t('breaks')}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ManageBreaks')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 ? (
          <MutedText>{t('noUpcomingAppointments')}</MutedText>
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
                    {a.guestClient ? a.guestClient.name : t('client')}
                  </MutedText>
                </View>
                <MutedText style={{ marginTop: spacing.xs }}>
                  {t('serviceCount', { count: a.serviceIds.length })}
                </MutedText>
              </Pressable>
            ))}
          </View>
        ))}
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
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
});
