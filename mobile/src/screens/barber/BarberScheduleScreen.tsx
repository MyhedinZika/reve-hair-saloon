import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import type { AppointmentDoc, UserDoc } from '@salon/shared';
import { firestore } from '../../config/firebase';
import {
  BodyText,
  Button,
  Heading,
  MutedText,
  Pill,
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

type Filter = 'upcoming' | 'past' | 'cancelled';

const FILTER_LABEL_KEY: Record<Filter, 'upcoming' | 'past' | 'cancelledStatus'> = {
  upcoming: 'upcoming',
  past: 'past',
  cancelled: 'cancelledStatus',
};

const STATUS_KEY: Record<
  AppointmentDoc['status'],
  'appointmentConfirmed' | 'appointmentCompleted' | 'appointmentCancelled' | 'appointmentCancelledBySalon' | 'appointmentNoShow'
> = {
  confirmed: 'appointmentConfirmed',
  completed: 'appointmentCompleted',
  cancelledByClient: 'appointmentCancelled',
  cancelledByAdmin: 'appointmentCancelledBySalon',
  noShow: 'appointmentNoShow',
};

export function BarberScheduleScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const { t } = useI18n();
  const barber = useMyBarber(profile?.uid ?? null);
  const [items, setItems] = useState<AppointmentDoc[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [clientsByUid, setClientsByUid] = useState<Record<string, UserDoc>>({});

  useEffect(() => {
    if (!barber) return;
    const unsub = stores.watchBarberAppointments(barber.id, setItems);
    return () => unsub();
  }, [barber]);

  useEffect(() => {
    const missing = Array.from(
      new Set(items.map((a) => a.clientId).filter((id): id is string => !!id)),
    ).filter((uid) => !(uid in clientsByUid));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        missing.map(async (uid) => {
          try {
            const snap = await getDoc(doc(firestore, 'users', uid));
            return [uid, snap.data() as UserDoc | undefined] as const;
          } catch {
            return [uid, undefined] as const;
          }
        }),
      );
      if (cancelled) return;
      setClientsByUid((prev) => {
        const next = { ...prev };
        for (const [uid, user] of entries) {
          if (user) next[uid] = user;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [items, clientsByUid]);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (filter === 'upcoming') {
      return items
        .filter((a) => a.status === 'confirmed' && a.endAt > now)
        .sort((a, b) => a.startAt - b.startAt);
    }
    if (filter === 'past') {
      return items
        .filter((a) => a.status === 'completed' || (a.status === 'confirmed' && a.endAt <= now))
        .sort((a, b) => b.startAt - a.startAt);
    }
    return items
      .filter(
        (a) =>
          a.status === 'cancelledByClient' ||
          a.status === 'cancelledByAdmin' ||
          a.status === 'noShow',
      )
      .sort((a, b) => b.startAt - a.startAt);
  }, [items, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentDoc[]>();
    for (const a of filtered) {
      const key = formatDateLong(a.startAt);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

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

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
        }}
      >
        {(['upcoming', 'past', 'cancelled'] as Filter[]).map((f) => (
          <Pill
            key={f}
            label={t(FILTER_LABEL_KEY[f])}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 ? (
          <MutedText>{t('noAppointmentsFilter')}</MutedText>
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
                    {a.guestClient
                      ? a.guestClient.name
                      : (a.clientId && clientsByUid[a.clientId]?.displayName) || t('client')}
                  </MutedText>
                </View>
                <MutedText style={{ marginTop: spacing.xs }}>
                  {t('serviceCount', { count: a.serviceIds.length })} · {t(STATUS_KEY[a.status])}
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
