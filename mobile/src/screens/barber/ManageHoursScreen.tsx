import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type TimeBlock,
  type WorkingHoursDoc,
} from '@salon/shared';
import {
  Button,
  Heading,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';
import { useMyBarber } from '../../hooks/useMyBarber';
import { BlockEditor } from '../../components/BlockEditor';

const LABEL: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

interface ManageHoursScreenProps {
  barberId?: string;
  hideTitle?: boolean;
}

export function ManageHoursScreen({ barberId, hideTitle }: ManageHoursScreenProps): React.JSX.Element {
  const { profile } = useAuth();
  const myBarber = useMyBarber(profile?.uid ?? null);
  const targetBarberId = barberId ?? myBarber?.id ?? null;

  const [day, setDay] = useState<DayOfWeek>('mon');
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!targetBarberId) return;
    let cancelled = false;
    setLoaded(false);
    const q = query(
      collection(firestore, 'workingHours'),
      where('barberId', '==', targetBarberId),
      where('dayOfWeek', '==', day),
    );
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const first = snap.docs[0];
        const data = first ? (first.data() as WorkingHoursDoc) : null;
        setBlocks(data?.blocks ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBlocks([]);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [targetBarberId, day]);

  const save = async (): Promise<void> => {
    if (!targetBarberId) return;
    setBusy(true);
    try {
      await api.updateWorkingHours({ barberId: targetBarberId, dayOfWeek: day, blocks });
      Alert.alert('Saved', 'Working hours updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  if (!targetBarberId) {
    return (
      <Screen>
        {hideTitle ? null : <Heading level={2}>Working hours</Heading>}
        <MutedText style={{ marginTop: spacing.lg }}>No barber profile linked.</MutedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {hideTitle ? null : (
          <Heading level={2} style={{ marginBottom: spacing.lg }}>Working hours</Heading>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DAYS_OF_WEEK.map((d) => (
            <Pill key={d} label={LABEL[d]} selected={d === day} onPress={() => setDay(d)} />
          ))}
        </View>

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
