import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import {
  addDaysToDateString,
  dateStringFromUtcMs,
  dayOfWeekFromDateString,
  parseDateString,
  todayDateString,
  type AppointmentDoc,
  type UserDoc,
} from '@salon/shared';
import { firestore } from '../../config/firebase';
import { BodyText, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { useMyBarber } from '../../hooks/useMyBarber';
import { formatTimeOfDay } from '../../util/format';
import type { BarberStackParamList, BarberTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Schedule'>,
  NativeStackScreenProps<BarberStackParamList>
>;

const DOW_SHORT: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const DAY_STRIP_COUNT = 7;

type StatusKind = 'done' | 'next' | 'walkin' | 'confirmed' | 'cancelled' | 'noShow';

interface StatusMeta {
  bar: string;
  pillBg: string;
  pillColor: string;
}

function getStatusKind(a: AppointmentDoc, nowMs: number): StatusKind {
  if (a.status === 'completed') return 'done';
  if (a.status === 'noShow') return 'noShow';
  if (a.status === 'cancelledByClient' || a.status === 'cancelledByAdmin') return 'cancelled';
  if (a.guestClient) return 'walkin';
  // confirmed: differentiate the very next one as 'next'
  if (nowMs >= a.startAt && nowMs < a.endAt) return 'next';
  return 'confirmed';
}

function statusMeta(kind: StatusKind): StatusMeta {
  switch (kind) {
    case 'done':
      return { bar: '#1f9162', pillBg: 'rgba(31,145,98,0.14)', pillColor: '#166746' };
    case 'next':
      return { bar: colors.accent, pillBg: '#FDF6EC', pillColor: '#AA630D' };
    case 'walkin':
      return { bar: colors.ink, pillBg: colors.bgAlt, pillColor: colors.mutedStrong };
    case 'cancelled':
    case 'noShow':
      return { bar: colors.muted, pillBg: colors.bgAlt, pillColor: colors.muted };
    case 'confirmed':
    default:
      return { bar: colors.ink, pillBg: colors.bgAlt, pillColor: colors.inkSoft };
  }
}

function statusLabel(kind: StatusKind, t: (k: never) => string): string {
  // We use plain ASCII labels for the design — i18n covers the more general statuses.
  switch (kind) {
    case 'done':
      return 'Done';
    case 'next':
      return 'Next';
    case 'walkin':
      return 'Walk-in';
    case 'cancelled':
      return 'Cancelled';
    case 'noShow':
      return 'No-show';
    case 'confirmed':
    default:
      return 'Confirmed';
  }
}

interface Day {
  date: string;
  dow: string;
  day: number;
}

function buildDays(centerDate: string): Day[] {
  const out: Day[] = [];
  for (let i = -1; i < DAY_STRIP_COUNT - 1; i++) {
    const d = addDaysToDateString(centerDate, i);
    const { day } = parseDateString(d);
    out.push({
      date: d,
      dow: DOW_SHORT[dayOfWeekFromDateString(d)] ?? '?',
      day,
    });
  }
  return out;
}

export function BarberScheduleScreen({ navigation }: Props): React.JSX.Element {
  const { profile } = useAuth();
  const { t } = useI18n();
  const barber = useMyBarber(profile?.uid ?? null);
  const [items, setItems] = useState<AppointmentDoc[]>([]);
  const [clientsByUid, setClientsByUid] = useState<Record<string, UserDoc>>({});
  const [selectedDate, setSelectedDate] = useState<string>(() => todayDateString());

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

  const days = useMemo(() => buildDays(todayDateString()), []);

  const daysAppointments = useMemo(() => {
    const now = Date.now();
    return items
      .filter((a) => dateStringFromUtcMs(a.startAt) === selectedDate)
      .filter(
        (a) =>
          a.status === 'confirmed' ||
          a.status === 'completed' ||
          a.status === 'noShow',
      )
      .sort((a, b) => a.startAt - b.startAt)
      .map((a) => ({ a, kind: getStatusKind(a, now) }));
  }, [items, selectedDate]);

  const greeting = barber?.displayName ? barber.displayName.split(' ')[0] : null;

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            {greeting ? (
              <Text style={styles.greeting}>{`Hi ${greeting} 👋`}</Text>
            ) : null}
            <Heading level={2}>{t('schedule')}</Heading>
          </View>
          <Pressable
            onPress={() =>
              navigation.navigate('CreateAppointment', { lockedBarberId: barber.id })
            }
            style={styles.newButton}
            hitSlop={6}
          >
            <Text style={styles.newButtonText}>+ New</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}
        >
          {days.map((d) => {
            const isSelected = d.date === selectedDate;
            const isToday = d.date === todayDateString();
            return (
              <Pressable
                key={d.date}
                onPress={() => setSelectedDate(d.date)}
                style={[
                  styles.dayCell,
                  isSelected ? styles.dayCellSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayCellDow,
                    isSelected ? styles.dayCellTextOnDark : null,
                  ]}
                >
                  {d.dow}
                </Text>
                <Text
                  style={[
                    styles.dayCellDay,
                    isSelected ? styles.dayCellTextOnDark : null,
                  ]}
                >
                  {d.day}
                </Text>
                {isToday && !isSelected ? <View style={styles.todayDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {daysAppointments.length === 0 ? (
          <View style={styles.emptyBlock}>
            <MutedText>{t('noAppointmentsFilter')}</MutedText>
          </View>
        ) : (
          daysAppointments.map(({ a, kind }) => {
            const meta = statusMeta(kind);
            const clientName = a.guestClient
              ? a.guestClient.name
              : (a.clientId && clientsByUid[a.clientId]?.displayName) || t('client');
            return (
              <Pressable
                key={a.id}
                onPress={() =>
                  navigation.navigate('AppointmentDetails', { appointmentId: a.id })
                }
                style={({ pressed }) => [
                  styles.timelineRow,
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <View style={styles.timelineTimeCol}>
                  <Text style={styles.timelineTime}>{formatTimeOfDay(a.startAt)}</Text>
                </View>
                <View style={[styles.timelineCard, { borderLeftColor: meta.bar }]}>
                  <View style={styles.timelineCardTopRow}>
                    <Text style={styles.timelineName}>
                      {a.guestClient ? `Guest · ${clientName}` : clientName}
                    </Text>
                    <View
                      style={[styles.statusPill, { backgroundColor: meta.pillBg }]}
                    >
                      <Text style={[styles.statusPillText, { color: meta.pillColor }]}>
                        {statusLabel(kind, t as never)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.timelineMeta}>
                    {t('serviceCount', { count: a.serviceIds.length })} ·{' '}
                    {Math.round((a.endAt - a.startAt) / 60000)} min
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  greeting: {
    fontSize: font.size.sm,
    color: colors.muted,
    fontWeight: font.weight.medium,
  },
  newButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: colors.ink,
  },
  newButtonText: {
    color: colors.card,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  dayStrip: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  dayCell: {
    width: 48,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dayCellSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dayCellDow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: font.weight.medium,
  },
  dayCellDay: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: font.weight.semibold,
    marginTop: 2,
  },
  dayCellTextOnDark: {
    color: colors.card,
  },
  todayDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  emptyBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineTimeCol: {
    width: 46,
    paddingTop: 3,
    alignItems: 'flex-end',
  },
  timelineTime: {
    fontSize: 13,
    fontWeight: font.weight.semibold,
    color: colors.ink,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: 12,
  },
  timelineCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineName: {
    fontSize: 14,
    fontWeight: font.weight.semibold,
    color: colors.ink,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
  },
  timelineMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },
});
