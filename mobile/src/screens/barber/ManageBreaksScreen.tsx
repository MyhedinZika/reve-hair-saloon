import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  parseDateString,
  todayDateString,
  type BreakDoc,
  type TimeBlock,
} from '@salon/shared';
import { Button, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';
import { useMyBarber } from '../../hooks/useMyBarber';
import { BlockEditor } from '../../components/BlockEditor';
import { formatDateShort } from '../../util/format';

interface ManageBreaksScreenProps {
  barberId?: string;
}

export function ManageBreaksScreen({ barberId }: ManageBreaksScreenProps): React.JSX.Element {
  const { profile } = useAuth();
  const myBarber = useMyBarber(profile?.uid ?? null);
  const targetBarberId = barberId ?? myBarber?.id ?? null;

  const [date, setDate] = useState<string>(todayDateString());
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!targetBarberId) return;
    setLoaded(false);
    const q = query(
      collection(firestore, 'breaks'),
      where('barberId', '==', targetBarberId),
      where('date', '==', date),
    );
    getDocs(q).then((snap) => {
      const first = snap.docs[0];
      const data = first ? (first.data() as BreakDoc) : null;
      setBlocks(data?.blocks ?? []);
      setLoaded(true);
    });
  }, [targetBarberId, date]);

  const dates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < DEFAULT_BOOKING_HORIZON_DAYS; i++) {
      out.push(addDaysToDateString(today, i));
    }
    return out;
  }, []);

  const save = async (): Promise<void> => {
    if (!targetBarberId) return;
    setBusy(true);
    try {
      await api.updateBreaks({ barberId: targetBarberId, date, blocks });
      Alert.alert('Saved', 'Breaks updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  if (!targetBarberId) {
    return (
      <Screen>
        <Heading level={2}>Breaks</Heading>
        <MutedText style={{ marginTop: spacing.lg }}>No barber profile linked.</MutedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Breaks</Heading>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
      >
        {dates.map((d) => {
          const { year, month, day } = parseDateString(d);
          const selected = d === date;
          return (
            <Pressable
              key={d}
              onPress={() => setDate(d)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: selected ? colors.ink : colors.card,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.border,
              }}
            >
              <MutedText
                style={{
                  color: selected ? colors.inkOnAccent : colors.ink,
                  fontWeight: font.weight.medium,
                }}
              >
                {formatDateShort(year, month, day)}
              </MutedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {!loaded ? (
          <MutedText>Loading…</MutedText>
        ) : (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}
        <Button title="Save" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
