import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  addDaysToDateString,
  parseDateString,
  todayDateString,
  type BreakDoc,
  type TimeBlock,
} from '@salon/shared';
import { Button, Heading, IconButton, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { api } from '../../api/functions';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { useMyBarber } from '../../hooks/useMyBarber';
import { BlockEditor } from '../../components/BlockEditor';
import { formatDateShort } from '../../util/format';

interface ManageBreaksScreenProps {
  barberId?: string;
}

export function ManageBreaksScreen({ barberId }: ManageBreaksScreenProps): React.JSX.Element {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { t } = useI18n();
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
      Alert.alert(t('saved'), t('breaksUpdated'));
    } catch (err) {
      Alert.alert(t('couldNotSave'), err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setBusy(false);
    }
  };

  if (!targetBarberId) {
    return (
      <Screen padded={false}>
        <BreaksHeader onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <MutedText>{t('noBarberProfileLinked')}</MutedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <BreaksHeader onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                  borderRadius: radius.lg,
                  backgroundColor: selected ? colors.accent : colors.card,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.border,
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

function BreaksHeader({ onBack }: { onBack: () => void }): React.JSX.Element {
  const { t } = useI18n();

  return (
    <View style={styles.header}>
      <IconButton label={t('back')} onPress={onBack}>
        <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
      </IconButton>
      <View>
        <Heading level={3}>{t('breaks')}</Heading>
        <MutedText>{t('blockTimeAway')}</MutedText>
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
