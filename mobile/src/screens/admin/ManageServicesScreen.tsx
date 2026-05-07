import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
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
import { font, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
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

  const create = async (): Promise<void> => {
    const priceCents = Math.round(parseFloat(price) * 100);
    const minutes = parseInt(duration, 10);
    if (!name.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      Alert.alert('Invalid', 'Name and price are required.');
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes % SLOT_MINUTES !== 0) {
      Alert.alert('Invalid duration', `Must be a positive multiple of ${SLOT_MINUTES} minutes.`);
      return;
    }
    setBusy(true);
    try {
      const ref = doc(collection(firestore, 'services'));
      const newDoc: ServiceDoc = {
        id: ref.id,
        name: name.trim(),
        priceCents,
        durationMinutes: minutes,
        active: true,
        createdAt: Date.now(),
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

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Services</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {services.map((s) => (
          <Card key={s.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
                  {s.name}
                </BodyText>
                <MutedText>
                  ${formatPrice(s.priceCents)} · {formatDuration(s.durationMinutes)} ·{' '}
                  {s.active ? 'Active' : 'Inactive'}
                </MutedText>
              </View>
              <Pressable onPress={() => void toggleActive(s)}>
                <BodyText style={{ color: s.active ? '#B91C1C' : '#15803D', fontWeight: font.weight.semibold }}>
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
            label={`Duration (multiple of ${SLOT_MINUTES} min)`}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />
          <Button title="Create" onPress={create} loading={busy} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
