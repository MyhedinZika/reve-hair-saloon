import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  DAYS_OF_WEEK,
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  parseDateString,
  todayDateString,
  type BreakDoc,
  type DayOfWeek,
  type RecurringBreakDoc,
  type TimeBlock,
  type WorkingHoursDoc,
} from '@salon/shared';
import { formatDateShort } from '../../util/format';
import {
  BodyText,
  Button,
  Card,
  Heading,
  IconButton,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';
import { useI18n, type TranslationKey } from '../../i18n/I18nContext';
import { useMyBarber } from '../../hooks/useMyBarber';

type DaysBlocks = Record<DayOfWeek, TimeBlock[]>;
type Mode = 'simple' | 'advanced';

const DAY_LABEL_KEY: Record<DayOfWeek, TranslationKey> = {
  mon: 'dayMon',
  tue: 'dayTue',
  wed: 'dayWed',
  thu: 'dayThu',
  fri: 'dayFri',
  sat: 'daySat',
  sun: 'daySun',
};

const SHORT_LABEL_KEY: Record<DayOfWeek, TranslationKey> = {
  mon: 'dayMon',
  tue: 'dayTue',
  wed: 'dayWed',
  thu: 'dayThu',
  fri: 'dayFri',
  sat: 'daySat',
  sun: 'daySun',
};

function emptyDays(): DaysBlocks {
  return DAYS_OF_WEEK.reduce<DaysBlocks>(
    (acc, d) => {
      acc[d] = [];
      return acc;
    },
    {} as DaysBlocks,
  );
}

function deepCloneDays(src: DaysBlocks): DaysBlocks {
  const out = emptyDays();
  for (const d of DAYS_OF_WEEK) {
    out[d] = src[d].map((b) => ({ ...b }));
  }
  return out;
}

function bumpHalfHour(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr!, 10);
  let m = parseInt(mStr!, 10);
  m += 30;
  if (m >= 60) {
    m -= 60;
    h += 1;
  }
  if (h >= 24) return '23:00';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function blocksEqual(a: TimeBlock[], b: TimeBlock[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.start !== b[i]!.start || a[i]!.end !== b[i]!.end) return false;
  }
  return true;
}

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  out.push('23:00');
  return out;
})();

/**
 * Detect whether the current schedule can be displayed in the simple mode
 * (single open block applied across some subset of days). If any open day has
 * more than one block, or open days have differing start/end, we fall back to
 * advanced.
 */
function deriveSimpleState(days: DaysBlocks): {
  fits: boolean;
  start: string;
  end: string;
  openDays: Set<DayOfWeek>;
} {
  const openDays = new Set<DayOfWeek>();
  let canon: { start: string; end: string } | null = null;
  let fits = true;
  for (const d of DAYS_OF_WEEK) {
    const blocks = days[d];
    if (blocks.length === 0) continue;
    if (blocks.length > 1) {
      fits = false;
      continue;
    }
    const b = blocks[0]!;
    if (!canon) {
      canon = { start: b.start, end: b.end };
    } else if (canon.start !== b.start || canon.end !== b.end) {
      fits = false;
    }
    openDays.add(d);
  }
  return {
    fits,
    start: canon?.start ?? '09:00',
    end: canon?.end ?? '17:00',
    openDays,
  };
}

interface ManageHoursScreenProps {
  barberId?: string;
  hideTitle?: boolean;
}

export function ManageHoursScreen({
  barberId,
  hideTitle,
}: ManageHoursScreenProps): React.JSX.Element {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { t } = useI18n();
  const myBarber = useMyBarber(profile?.uid ?? null);
  const targetBarberId = barberId ?? myBarber?.id ?? null;

  const [original, setOriginal] = useState<DaysBlocks>(emptyDays);
  const [draft, setDraft] = useState<DaysBlocks>(emptyDays);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>('simple');
  const [picker, setPicker] = useState<
    | { kind: 'simple'; field: 'start' | 'end' }
    | { kind: 'advanced'; day: DayOfWeek; blockIdx: number; field: 'start' | 'end' }
    | null
  >(null);

  // Simple-mode state — derived from draft when in simple mode.
  const simpleSnapshot = useMemo(() => deriveSimpleState(draft), [draft]);
  const [simpleStart, setSimpleStart] = useState<string>('09:00');
  const [simpleEnd, setSimpleEnd] = useState<string>('17:00');
  const [simpleOpenDays, setSimpleOpenDays] = useState<Set<DayOfWeek>>(
    () => new Set(['mon', 'tue', 'wed', 'thu', 'fri']),
  );

  // Breaks (per-date, next 14 days).
  const [breaks, setBreaks] = useState<Record<string, TimeBlock[]>>({});
  // Recurring breaks (per day-of-week).
  const [recurringBreaks, setRecurringBreaks] = useState<Record<DayOfWeek, TimeBlock[]>>(
    () => emptyDays(),
  );
  const [breakAdd, setBreakAdd] = useState<{
    open: boolean;
    /** 'date' for one-off, day-of-week for recurring. */
    repeat: 'date' | DayOfWeek;
    date: string;
    start: string;
    end: string;
  }>({
    open: false,
    repeat: 'date',
    date: todayDateString(),
    start: '13:00',
    end: '14:00',
  });
  const [breakPicker, setBreakPicker] = useState<
    null | { field: 'date' } | { field: 'start' | 'end' }
  >(null);

  const upcomingDates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < DEFAULT_BOOKING_HORIZON_DAYS; i++) {
      out.push(addDaysToDateString(today, i));
    }
    return out;
  }, []);

  useEffect(() => {
    if (!targetBarberId) return;
    let cancelled = false;
    setLoaded(false);
    const q = query(collection(firestore, 'workingHours'), where('barberId', '==', targetBarberId));
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const next = emptyDays();
        for (const doc of snap.docs) {
          const data = doc.data() as WorkingHoursDoc;
          if (data.dayOfWeek in next) {
            next[data.dayOfWeek] = data.blocks ?? [];
          }
        }
        setOriginal(next);
        setDraft(deepCloneDays(next));
        const snap2 = deriveSimpleState(next);
        if (snap2.fits) {
          setMode('simple');
          setSimpleStart(snap2.start);
          setSimpleEnd(snap2.end);
          setSimpleOpenDays(snap2.openDays);
        } else {
          setMode('advanced');
        }
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOriginal(emptyDays());
        setDraft(emptyDays());
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [targetBarberId]);

  // Load upcoming breaks for the barber.
  useEffect(() => {
    if (!targetBarberId) return;
    let cancelled = false;
    const today = todayDateString();
    const q = query(collection(firestore, 'breaks'), where('barberId', '==', targetBarberId));
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const next: Record<string, TimeBlock[]> = {};
        for (const doc of snap.docs) {
          const data = doc.data() as BreakDoc;
          if (data.date >= today && (data.blocks?.length ?? 0) > 0) {
            next[data.date] = data.blocks;
          }
        }
        setBreaks(next);
      })
      .catch(() => {
        if (!cancelled) setBreaks({});
      });
    return () => {
      cancelled = true;
    };
  }, [targetBarberId]);

  // Load recurring breaks (per day-of-week).
  useEffect(() => {
    if (!targetBarberId) return;
    let cancelled = false;
    const q = query(
      collection(firestore, 'recurringBreaks'),
      where('barberId', '==', targetBarberId),
    );
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const next = emptyDays();
        for (const doc of snap.docs) {
          const data = doc.data() as RecurringBreakDoc;
          if (data.dayOfWeek in next && (data.blocks?.length ?? 0) > 0) {
            next[data.dayOfWeek] = data.blocks;
          }
        }
        setRecurringBreaks(next);
      })
      .catch(() => {
        if (!cancelled) setRecurringBreaks(emptyDays());
      });
    return () => {
      cancelled = true;
    };
  }, [targetBarberId]);

  // When in simple mode, pushing simple state changes into draft.
  useEffect(() => {
    if (mode !== 'simple') return;
    setDraft((prev) => {
      const next = deepCloneDays(prev);
      for (const d of DAYS_OF_WEEK) {
        next[d] = simpleOpenDays.has(d) ? [{ start: simpleStart, end: simpleEnd }] : [];
      }
      return next;
    });
  }, [mode, simpleStart, simpleEnd, simpleOpenDays]);

  const dirtyDays = useMemo<DayOfWeek[]>(
    () => DAYS_OF_WEEK.filter((d) => !blocksEqual(original[d], draft[d])),
    [original, draft],
  );

  const onPickTime = (value: string): void => {
    if (!picker) return;
    if (picker.kind === 'simple') {
      if (picker.field === 'start') {
        if (value >= simpleEnd) {
          Alert.alert(t('couldNotSave'), 'Start must be before end.');
          setPicker(null);
          return;
        }
        setSimpleStart(value);
      } else {
        if (value <= simpleStart) {
          Alert.alert(t('couldNotSave'), 'End must be after start.');
          setPicker(null);
          return;
        }
        setSimpleEnd(value);
      }
    } else {
      const { day, blockIdx, field } = picker;
      const currentBlocks = draft[day];
      const block = currentBlocks[blockIdx];
      if (!block) {
        setPicker(null);
        return;
      }
      const updated: TimeBlock = { ...block, [field]: value };
      if (field === 'start' && updated.start >= updated.end) {
        Alert.alert(t('couldNotSave'), 'Start must be before end.');
        setPicker(null);
        return;
      }
      if (field === 'end' && updated.end <= updated.start) {
        Alert.alert(t('couldNotSave'), 'End must be after start.');
        setPicker(null);
        return;
      }
      setDraft((prev) => ({
        ...prev,
        [day]: currentBlocks.map((b, i) => (i === blockIdx ? updated : b)),
      }));
    }
    setPicker(null);
  };

  const toggleSimpleDay = (day: DayOfWeek): void => {
    setSimpleOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const switchToAdvanced = (): void => setMode('advanced');
  const switchToSimple = (): void => {
    const snap = deriveSimpleState(draft);
    if (snap.fits) {
      setSimpleStart(snap.start);
      setSimpleEnd(snap.end);
      setSimpleOpenDays(snap.openDays);
    }
    setMode('simple');
  };

  const addBlock = (day: DayOfWeek): void => {
    setDraft((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: '09:00', end: '17:00' }],
    }));
  };

  const removeBlock = (day: DayOfWeek, idx: number): void => {
    setDraft((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx),
    }));
  };

  const toggleAdvancedDay = (day: DayOfWeek, willBeOpen: boolean): void => {
    setDraft((prev) => ({
      ...prev,
      [day]: willBeOpen ? [{ start: '09:00', end: '17:00' }] : [],
    }));
  };

  const saveBreak = async (): Promise<void> => {
    if (!targetBarberId) return;
    if (breakAdd.start >= breakAdd.end) {
      Alert.alert(t('couldNotSave'), 'Start must be before end.');
      return;
    }
    const newBlock: TimeBlock = { start: breakAdd.start, end: breakAdd.end };

    try {
      if (breakAdd.repeat === 'date') {
        const existing = breaks[breakAdd.date] ?? [];
        const next = [...existing, newBlock].sort((a, b) => a.start.localeCompare(b.start));
        await api.updateBreaks({
          barberId: targetBarberId,
          date: breakAdd.date,
          blocks: next,
        });
        setBreaks((prev) => ({ ...prev, [breakAdd.date]: next }));
      } else {
        const dow = breakAdd.repeat;
        const existing = recurringBreaks[dow] ?? [];
        const next = [...existing, newBlock].sort((a, b) => a.start.localeCompare(b.start));
        await api.updateRecurringBreaks({
          barberId: targetBarberId,
          dayOfWeek: dow,
          blocks: next,
        });
        setRecurringBreaks((prev) => ({ ...prev, [dow]: next }));
      }
      setBreakAdd({
        open: false,
        repeat: 'date',
        date: todayDateString(),
        start: '13:00',
        end: '14:00',
      });
    } catch (err) {
      Alert.alert(t('couldNotSave'), err instanceof Error ? err.message : t('unknownError'));
    }
  };

  const removeBreak = async (date: string, idx: number): Promise<void> => {
    if (!targetBarberId) return;
    const existing = breaks[date] ?? [];
    const next = existing.filter((_, i) => i !== idx);
    try {
      await api.updateBreaks({ barberId: targetBarberId, date, blocks: next });
      setBreaks((prev) => {
        const updated = { ...prev };
        if (next.length === 0) delete updated[date];
        else updated[date] = next;
        return updated;
      });
    } catch (err) {
      Alert.alert(t('couldNotSave'), err instanceof Error ? err.message : t('unknownError'));
    }
  };

  const removeRecurringBreak = async (day: DayOfWeek, idx: number): Promise<void> => {
    if (!targetBarberId) return;
    const existing = recurringBreaks[day] ?? [];
    const next = existing.filter((_, i) => i !== idx);
    try {
      await api.updateRecurringBreaks({
        barberId: targetBarberId,
        dayOfWeek: day,
        blocks: next,
      });
      setRecurringBreaks((prev) => ({ ...prev, [day]: next }));
    } catch (err) {
      Alert.alert(t('couldNotSave'), err instanceof Error ? err.message : t('unknownError'));
    }
  };

  const onPickBreakValue = (value: string): void => {
    if (!breakPicker) return;
    setBreakAdd((prev) => {
      if (breakPicker.field === 'date') return { ...prev, date: value };
      if (breakPicker.field === 'start') {
        return { ...prev, start: value, end: prev.end <= value ? bumpHalfHour(value) : prev.end };
      }
      return { ...prev, end: value };
    });
    setBreakPicker(null);
  };

  const sortedBreakDates = useMemo(
    () => Object.keys(breaks).sort((a, b) => a.localeCompare(b)),
    [breaks],
  );

  const save = async (): Promise<void> => {
    if (!targetBarberId) return;
    if (dirtyDays.length === 0) {
      Alert.alert(t('saved'), t('nothingChanged'));
      return;
    }
    setBusy(true);
    const results = await Promise.allSettled(
      dirtyDays.map((d) =>
        api.updateWorkingHours({
          barberId: targetBarberId,
          dayOfWeek: d,
          blocks: draft[d],
        }),
      ),
    );
    const failed = results
      .map((r, i) => ({ r, day: dirtyDays[i]! }))
      .filter(({ r }) => r.status === 'rejected');
    setBusy(false);

    if (failed.length === 0) {
      setOriginal(deepCloneDays(draft));
      Alert.alert(t('saved'), t('workingHoursUpdated'));
      return;
    }
    const partialOriginal = deepCloneDays(original);
    dirtyDays.forEach((d, i) => {
      if (results[i]!.status === 'fulfilled') {
        partialOriginal[d] = draft[d].map((b) => ({ ...b }));
      }
    });
    setOriginal(partialOriginal);
    const firstError = failed[0]!.r;
    const errMsg =
      firstError.status === 'rejected' && firstError.reason instanceof Error
        ? firstError.reason.message
        : t('unknownError');
    Alert.alert(
      t('couldNotSave'),
      `${t('hoursPartiallySaved', {
        ok: dirtyDays.length - failed.length,
        failed: failed.length,
      })}\n\n${errMsg}`,
    );
  };

  if (!targetBarberId) {
    return (
      <Screen padded={!!hideTitle}>
        {hideTitle ? null : <HoursHeader onBack={() => navigation.goBack()} />}
        <View style={hideTitle ? null : styles.contentPad}>
          <MutedText style={{ marginTop: spacing.lg }}>{t('noBarberProfileLinked')}</MutedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={!!hideTitle}>
      {hideTitle ? null : <HoursHeader onBack={() => navigation.goBack()} />}
      <ScrollView
        contentContainerStyle={hideTitle ? styles.contentInner : styles.contentPad}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {!loaded ? (
          <MutedText>{t('loading')}</MutedText>
        ) : mode === 'simple' ? (
          <SimpleEditor
            start={simpleStart}
            end={simpleEnd}
            openDays={simpleOpenDays}
            onPickStart={() => setPicker({ kind: 'simple', field: 'start' })}
            onPickEnd={() => setPicker({ kind: 'simple', field: 'end' })}
            onToggleDay={toggleSimpleDay}
            onSwitchToAdvanced={switchToAdvanced}
          />
        ) : (
          <AdvancedEditor
            draft={draft}
            onAdvancedBack={switchToSimple}
            simpleFits={simpleSnapshot.fits}
            onPickTime={(day, blockIdx, field) =>
              setPicker({ kind: 'advanced', day, blockIdx, field })
            }
            onAddBlock={addBlock}
            onRemoveBlock={removeBlock}
            onToggleDay={toggleAdvancedDay}
          />
        )}

        {loaded ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <View>
              <Text style={styles.sectionTitle}>{t('breaks')}</Text>
              <MutedText style={{ fontSize: font.size.sm, marginTop: 2 }}>
                {t('breaksHint')}
              </MutedText>
            </View>

            {sortedBreakDates.length === 0 &&
            DAYS_OF_WEEK.every((d) => (recurringBreaks[d] ?? []).length === 0) ? (
              <MutedText>{t('noBreaks')}</MutedText>
            ) : (
              <>
                {DAYS_OF_WEEK.map((day) =>
                  (recurringBreaks[day] ?? []).map((block, idx) => (
                    <View key={`r-${day}-${idx}`} style={styles.breakBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.breakBannerTitle}>
                          {t('breakLine', { start: block.start, end: block.end })}
                        </Text>
                        <Text style={styles.breakBannerMeta}>
                          Every {t(DAY_LABEL_KEY[day])}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void removeRecurringBreak(day, idx)}
                        hitSlop={6}
                        style={styles.breakRemove}
                      >
                        <Text style={styles.breakRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  )),
                )}
                {sortedBreakDates.map((date) =>
                  (breaks[date] ?? []).map((block, idx) => (
                    <View key={`d-${date}-${idx}`} style={styles.breakBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.breakBannerTitle}>
                          {t('breakLine', { start: block.start, end: block.end })}
                        </Text>
                        <Text style={styles.breakBannerMeta}>{prettyDate(date)}</Text>
                      </View>
                      <Pressable
                        onPress={() => void removeBreak(date, idx)}
                        hitSlop={6}
                        style={styles.breakRemove}
                      >
                        <Text style={styles.breakRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  )),
                )}
              </>
            )}

            {breakAdd.open ? (
              <Card style={{ gap: spacing.sm }}>
                <Text style={styles.sectionTitle}>{t('addBreak')}</Text>

                <Text style={styles.fullChipLabel}>Repeats</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingRight: spacing.lg }}
                >
                  {(['date', ...DAYS_OF_WEEK] as const).map((opt) => {
                    const selected = breakAdd.repeat === opt;
                    const label =
                      opt === 'date'
                        ? 'Just this date'
                        : `Every ${t(DAY_LABEL_KEY[opt as DayOfWeek])}`;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() =>
                          setBreakAdd((prev) => ({ ...prev, repeat: opt }))
                        }
                        style={[styles.repeatChip, selected ? styles.repeatChipSelected : null]}
                      >
                        <Text
                          style={[
                            styles.repeatChipText,
                            selected ? styles.repeatChipTextSelected : null,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {breakAdd.repeat === 'date' ? (
                  <Pressable
                    onPress={() => setBreakPicker({ field: 'date' })}
                    style={styles.fullChip}
                  >
                    <Text style={styles.fullChipLabel}>{t('pickDate')}</Text>
                    <Text style={styles.fullChipValue}>{prettyDate(breakAdd.date)}</Text>
                  </Pressable>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Pressable
                    onPress={() => setBreakPicker({ field: 'start' })}
                    style={[styles.fullChip, { flex: 1 }]}
                  >
                    <Text style={styles.fullChipLabel}>From</Text>
                    <Text style={styles.fullChipValue}>{breakAdd.start}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setBreakPicker({ field: 'end' })}
                    style={[styles.fullChip, { flex: 1 }]}
                  >
                    <Text style={styles.fullChipLabel}>To</Text>
                    <Text style={styles.fullChipValue}>{breakAdd.end}</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title={t('save')} onPress={() => void saveBreak()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={() =>
                        setBreakAdd({
                          open: false,
                          repeat: 'date',
                          date: todayDateString(),
                          start: '13:00',
                          end: '14:00',
                        })
                      }
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <Pressable
                onPress={() =>
                  setBreakAdd((prev) => ({ ...prev, open: true }))
                }
                style={styles.addBreakButton}
              >
                <Text style={styles.addBreakButtonText}>+ {t('addBreak')}</Text>
              </Pressable>
            )}

            <Button
              title={t('save')}
              onPress={save}
              loading={busy}
              disabled={dirtyDays.length === 0 || busy}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : null}
      </ScrollView>

      <TimePickerModal
        visible={picker !== null}
        current={
          picker?.kind === 'simple'
            ? picker.field === 'start'
              ? simpleStart
              : simpleEnd
            : picker?.kind === 'advanced'
              ? draft[picker.day][picker.blockIdx]?.[picker.field] ?? null
              : null
        }
        onPick={onPickTime}
        onClose={() => setPicker(null)}
        title={t('pickTime')}
      />

      <Modal
        visible={breakPicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setBreakPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBreakPicker(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalGrabber} />
            <BodyText style={{ fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
              {breakPicker?.field === 'date' ? t('pickDate') : t('pickTime')}
            </BodyText>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {breakPicker?.field === 'date'
                ? upcomingDates.map((d) => {
                    const selected = d === breakAdd.date;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => onPickBreakValue(d)}
                        style={[styles.modalRow, selected ? styles.modalRowSelected : null]}
                      >
                        <Text
                          style={[
                            styles.modalRowText,
                            selected ? styles.modalRowTextSelected : null,
                          ]}
                        >
                          {prettyDate(d)}
                        </Text>
                      </Pressable>
                    );
                  })
                : TIME_OPTIONS.map((time) => {
                    const cur =
                      breakPicker?.field === 'start' ? breakAdd.start : breakAdd.end;
                    const selected = time === cur;
                    return (
                      <Pressable
                        key={time}
                        onPress={() => onPickBreakValue(time)}
                        style={[styles.modalRow, selected ? styles.modalRowSelected : null]}
                      >
                        <Text
                          style={[
                            styles.modalRowText,
                            selected ? styles.modalRowTextSelected : null,
                          ]}
                        >
                          {time}
                        </Text>
                      </Pressable>
                    );
                  })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function prettyDate(date: string): string {
  const { year, month, day } = parseDateString(date);
  return formatDateShort(year, month, day);
}

interface SimpleEditorProps {
  start: string;
  end: string;
  openDays: Set<DayOfWeek>;
  onPickStart: () => void;
  onPickEnd: () => void;
  onToggleDay: (day: DayOfWeek) => void;
  onSwitchToAdvanced: () => void;
}

function SimpleEditor({
  start,
  end,
  openDays,
  onPickStart,
  onPickEnd,
  onToggleDay,
  onSwitchToAdvanced,
}: SimpleEditorProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <BodyText style={{ fontWeight: font.weight.semibold }}>{t('openFromTo')}</BodyText>
        <View style={styles.simpleTimeRow}>
          <Pressable onPress={onPickStart} style={styles.simpleTimeChip}>
            <Text style={styles.simpleTimeText}>{start}</Text>
          </Pressable>
          <Text style={styles.dashSep}>–</Text>
          <Pressable onPress={onPickEnd} style={styles.simpleTimeChip}>
            <Text style={styles.simpleTimeText}>{end}</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <BodyText style={{ fontWeight: font.weight.semibold }}>{t('onTheseDays')}</BodyText>
        <View style={styles.dayPillRow}>
          {DAYS_OF_WEEK.map((d) => {
            const selected = openDays.has(d);
            return (
              <Pressable
                key={d}
                onPress={() => onToggleDay(d)}
                style={[styles.dayPill, selected ? styles.dayPillSelected : null]}
              >
                <Text
                  style={[styles.dayPillText, selected ? styles.dayPillTextSelected : null]}
                >
                  {t(SHORT_LABEL_KEY[d]).slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Pressable onPress={onSwitchToAdvanced} hitSlop={6}>
        <Text style={styles.linkText}>{t('customizePerDay')} →</Text>
      </Pressable>
    </View>
  );
}

interface AdvancedEditorProps {
  draft: DaysBlocks;
  simpleFits: boolean;
  onAdvancedBack: () => void;
  onPickTime: (day: DayOfWeek, blockIdx: number, field: 'start' | 'end') => void;
  onAddBlock: (day: DayOfWeek) => void;
  onRemoveBlock: (day: DayOfWeek, idx: number) => void;
  onToggleDay: (day: DayOfWeek, willBeOpen: boolean) => void;
}

function AdvancedEditor({
  draft,
  simpleFits,
  onAdvancedBack,
  onPickTime,
  onAddBlock,
  onRemoveBlock,
  onToggleDay,
}: AdvancedEditorProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <View style={{ gap: spacing.md }}>
      {simpleFits ? (
        <Pressable onPress={onAdvancedBack} hitSlop={6}>
          <Text style={styles.linkText}>← {t('backToSimple')}</Text>
        </Pressable>
      ) : (
        <MutedText style={{ fontSize: font.size.sm }}>{t('advancedHoursWarning')}</MutedText>
      )}

      {DAYS_OF_WEEK.map((day) => {
        const blocks = draft[day];
        const isOpen = blocks.length > 0;
        return (
          <Card key={day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                {t(DAY_LABEL_KEY[day])}
              </BodyText>
              <Switch
                value={isOpen}
                onValueChange={(v) => onToggleDay(day, v)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.card}
                ios_backgroundColor={colors.border}
              />
            </View>
            {!isOpen ? (
              <MutedText style={{ fontSize: font.size.sm }}>{t('closed')}</MutedText>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {blocks.map((block, blockIdx) => (
                  <View key={blockIdx} style={styles.blockRow}>
                    <Pressable
                      onPress={() => onPickTime(day, blockIdx, 'start')}
                      style={styles.timeChip}
                    >
                      <Text style={styles.timeChipText}>{block.start}</Text>
                    </Pressable>
                    <Text style={styles.dashSep}>–</Text>
                    <Pressable
                      onPress={() => onPickTime(day, blockIdx, 'end')}
                      style={styles.timeChip}
                    >
                      <Text style={styles.timeChipText}>{block.end}</Text>
                    </Pressable>
                    {blocks.length > 1 ? (
                      <Pressable
                        onPress={() => onRemoveBlock(day, blockIdx)}
                        style={styles.removeBtn}
                        hitSlop={6}
                      >
                        <Text style={styles.removeBtnText}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <Pressable onPress={() => onAddBlock(day)} hitSlop={6}>
                  <Text style={styles.linkText}>+ {t('addAnotherBlock')}</Text>
                </Pressable>
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

function HoursHeader({ onBack }: { onBack: () => void }): React.JSX.Element {
  const { t } = useI18n();

  return (
    <View style={styles.header}>
      <IconButton label={t('back')} onPress={onBack}>
        <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
      </IconButton>
      <View>
        <Heading level={3}>{t('workingHours')}</Heading>
        <MutedText>{t('setWeeklyAvailability')}</MutedText>
      </View>
    </View>
  );
}

interface TimePickerModalProps {
  visible: boolean;
  current: string | null;
  onPick: (value: string) => void;
  onClose: () => void;
  title: string;
}

function TimePickerModal({
  visible,
  current,
  onPick,
  onClose,
  title,
}: TimePickerModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalGrabber} />
          <BodyText style={{ fontWeight: font.weight.semibold, marginBottom: spacing.md }}>
            {title}
          </BodyText>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {TIME_OPTIONS.map((time) => {
              const selected = time === current;
              return (
                <Pressable
                  key={time}
                  onPress={() => onPick(time)}
                  style={[styles.modalRow, selected ? styles.modalRowSelected : null]}
                >
                  <Text
                    style={[styles.modalRowText, selected ? styles.modalRowTextSelected : null]}
                  >
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  contentPad: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  contentInner: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  simpleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  simpleTimeChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  simpleTimeText: {
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
    color: colors.ink,
  },
  dayPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 56,
    alignItems: 'center',
  },
  dayPillSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dayPillText: {
    color: colors.ink,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  dayPillTextSelected: {
    color: colors.card,
  },
  dayCard: {
    gap: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 84,
    alignItems: 'center',
  },
  timeChipText: {
    color: colors.ink,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  dashSep: {
    color: colors.muted,
    fontSize: font.size.md,
  },
  removeBtn: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: font.weight.semibold,
    lineHeight: 24,
  },
  linkText: {
    color: colors.accent,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  modalGrabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  modalRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  modalRowSelected: {
    backgroundColor: colors.bgAlt,
  },
  modalRowText: {
    color: colors.ink,
    fontSize: font.size.md,
  },
  modalRowTextSelected: {
    color: colors.accent,
    fontWeight: font.weight.semibold,
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.ink,
  },
  breakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#FADBB6',
    borderRadius: 14,
    padding: 14,
    gap: spacing.md,
  },
  breakBannerTitle: {
    fontSize: 14,
    fontWeight: font.weight.semibold,
    color: '#AA630D',
  },
  breakBannerMeta: {
    fontSize: 11,
    color: '#AA630D',
    opacity: 0.8,
    marginTop: 1,
  },
  breakRemove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakRemoveText: {
    color: '#AA630D',
    fontSize: 22,
    fontWeight: font.weight.semibold,
    lineHeight: 24,
  },
  fullChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullChipLabel: {
    color: colors.muted,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  fullChipValue: {
    color: colors.ink,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  addBreakButton: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  addBreakButtonText: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  repeatChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  repeatChipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  repeatChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: font.weight.semibold,
  },
  repeatChipTextSelected: {
    color: colors.card,
  },
});
