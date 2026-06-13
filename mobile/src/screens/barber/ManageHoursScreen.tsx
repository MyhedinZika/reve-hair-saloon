import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  IconButton,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { colors, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
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
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { t } = useI18n();
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
      Alert.alert(t('saved'), t('workingHoursUpdated'));
    } catch (err) {
      Alert.alert(t('couldNotSave'), err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setBusy(false);
    }
  };

  if (!targetBarberId) {
    return (
      <Screen padded={!!hideTitle}>
        {hideTitle ? null : <HoursHeader onBack={() => navigation.goBack()} />}
        <View style={hideTitle ? null : styles.content}>
          <MutedText style={{ marginTop: spacing.lg }}>{t('noBarberProfileLinked')}</MutedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={!!hideTitle}>
      {hideTitle ? null : <HoursHeader onBack={() => navigation.goBack()} />}
      <ScrollView
        contentContainerStyle={[
          hideTitle ? { paddingBottom: spacing.xxl, gap: spacing.md } : styles.content,
        ]}
        showsVerticalScrollIndicator={false}
      >

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DAYS_OF_WEEK.map((d) => (
            <Pill key={d} label={LABEL[d]} selected={d === day} onPress={() => setDay(d)} />
          ))}
        </View>

        {!loaded ? (
          <MutedText>{t('loading')}</MutedText>
        ) : (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}
        <Button title={t('save')} onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
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
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
});
