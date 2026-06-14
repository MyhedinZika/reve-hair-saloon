import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { SLOT_MINUTES, type ServiceDoc } from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Heading,
  Input,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { compareServiceOrder } from '../../api/firestore';
import { formatDuration, formatPrice } from '../../util/format';

export function ManageServicesScreen(): React.JSX.Element {
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState(`${SLOT_MINUTES}`);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'services'), (snap) => {
      setServices(snap.docs.map((d) => d.data() as ServiceDoc));
    });
    return () => unsub();
  }, []);

  const sorted = useMemo(() => [...services].sort(compareServiceOrder), [services]);

  const create = async (): Promise<void> => {
    const priceCents = Math.round(parseFloat(price) * 100);
    const minutes = parseInt(duration, 10);
    if (!name.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      Alert.alert('Invalid', 'Name and price are required.');
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      Alert.alert('Invalid duration', 'Must be a positive number of minutes.');
      return;
    }
    setBusy(true);
    try {
      const ref = doc(collection(firestore, 'services'));
      // Append to the end of the existing order.
      const maxOrder = sorted.reduce(
        (max, s) => (typeof s.sortOrder === 'number' && s.sortOrder > max ? s.sortOrder : max),
        -1,
      );
      const newDoc: ServiceDoc = {
        id: ref.id,
        name: name.trim(),
        priceCents,
        durationMinutes: minutes,
        active: true,
        createdAt: Date.now(),
        sortOrder: maxOrder + 1,
      };
      await setDoc(ref, newDoc);
      setName('');
      setPrice('');
      setDuration(`${SLOT_MINUTES}`);
    } catch (err) {
      Alert.alert('Could not create', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (s: ServiceDoc): Promise<void> => {
    try {
      await updateDoc(doc(firestore, 'services', s.id), { active: !s.active });
    } catch (err) {
      Alert.alert('Could not update', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const swapOrder = async (idx: number, direction: -1 | 1): Promise<void> => {
    const other = idx + direction;
    if (other < 0 || other >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[other]!;

    // Compute new order values: assign sequential indices to the displayed list,
    // swap positions of a and b. Write only the two changed docs.
    const newOrder = sorted.map((s, i) => ({ s, order: i }));
    newOrder[idx] = { s: a, order: other };
    newOrder[other] = { s: b, order: idx };

    try {
      await Promise.all([
        updateDoc(doc(firestore, 'services', a.id), { sortOrder: other }),
        updateDoc(doc(firestore, 'services', b.id), { sortOrder: idx }),
      ]);
      // Ensure docs without sortOrder get one on first swap so the order is stable.
      const normalizationWrites: Promise<void>[] = [];
      sorted.forEach((s, i) => {
        if (s.id === a.id || s.id === b.id) return;
        if (typeof s.sortOrder !== 'number') {
          normalizationWrites.push(
            updateDoc(doc(firestore, 'services', s.id), { sortOrder: i }),
          );
        }
      });
      if (normalizationWrites.length > 0) await Promise.all(normalizationWrites);
    } catch (err) {
      Alert.alert('Could not reorder', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {sorted.length > 1 ? (
          <MutedText style={{ fontSize: font.size.xs }}>
            Drag the order — use the ▲ / ▼ buttons to reorder how services appear to clients.
          </MutedText>
        ) : null}

        {sorted.map((s, idx) => (
          <Card key={s.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={styles.reorderCol}>
                <Pressable
                  onPress={() => void swapOrder(idx, -1)}
                  disabled={idx === 0}
                  style={[styles.reorderBtn, idx === 0 ? styles.reorderBtnDisabled : null]}
                  hitSlop={4}
                >
                  <Text style={[styles.reorderText, idx === 0 ? styles.reorderTextDisabled : null]}>▲</Text>
                </Pressable>
                <Pressable
                  onPress={() => void swapOrder(idx, 1)}
                  disabled={idx === sorted.length - 1}
                  style={[
                    styles.reorderBtn,
                    idx === sorted.length - 1 ? styles.reorderBtnDisabled : null,
                  ]}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.reorderText,
                      idx === sorted.length - 1 ? styles.reorderTextDisabled : null,
                    ]}
                  >
                    ▼
                  </Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
                  {s.name}
                </BodyText>
                <MutedText>
                  €{formatPrice(s.priceCents)} · {formatDuration(s.durationMinutes)} ·{' '}
                  {s.active ? 'Active' : 'Inactive'}
                </MutedText>
              </View>
              <Pressable onPress={() => void toggleActive(s)}>
                <BodyText
                  style={{
                    color: s.active ? colors.danger : colors.success,
                    fontWeight: font.weight.semibold,
                  }}
                >
                  {s.active ? 'Deactivate' : 'Activate'}
                </BodyText>
              </Pressable>
            </View>
          </Card>
        ))}

        <Heading level={3} style={{ marginTop: spacing.lg }}>Add service</Heading>
        <Card style={{ gap: spacing.sm }}>
          <Input label="Name" value={name} onChangeText={setName} />
          <Input
            label="Price (whole units, e.g. 25.00)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <Input
            label="Duration (minutes)"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />
          <MutedText style={{ fontSize: font.size.xs }}>
            Note: bookings are scheduled in {SLOT_MINUTES}-minute slots, so any service shorter than {SLOT_MINUTES} min still reserves a full slot on the calendar.
          </MutedText>
          <Button title="Create" onPress={create} loading={busy} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reorderCol: {
    gap: 6,
  },
  reorderBtn: {
    width: 28,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.4,
  },
  reorderText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: font.weight.semibold,
  },
  reorderTextDisabled: {
    color: colors.muted,
  },
});
