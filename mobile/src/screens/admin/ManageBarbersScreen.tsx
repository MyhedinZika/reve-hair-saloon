import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { BarberDoc, ServiceDoc } from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Heading,
  Input,
  MutedText,
  Pill,
  Screen,
} from '../../theme/components';
import { font, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';

export function ManageBarbersScreen(): React.JSX.Element {
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubB = onSnapshot(collection(firestore, 'barbers'), (snap) => {
      setBarbers(snap.docs.map((d) => d.data() as BarberDoc));
    });
    const unsubS = onSnapshot(collection(firestore, 'services'), (snap) => {
      setServices(snap.docs.map((d) => d.data() as ServiceDoc));
    });
    return () => {
      unsubB();
      unsubS();
    };
  }, []);

  const create = async (): Promise<void> => {
    if (!name.trim() || !userId.trim()) {
      Alert.alert('Missing fields', 'Display name and user id are required.');
      return;
    }
    setBusy(true);
    try {
      const ref = doc(collection(firestore, 'barbers'));
      const newDoc: BarberDoc = {
        id: ref.id,
        userId: userId.trim(),
        displayName: name.trim(),
        avatarUrl: null,
        serviceIds: Array.from(selected),
        active: true,
        createdAt: Date.now(),
      };
      await setDoc(ref, newDoc);
      await updateDoc(doc(firestore, 'users', userId.trim()), { role: 'barber' }).catch(() => undefined);
      setName('');
      setUserId('');
      setSelected(new Set());
    } catch (err) {
      Alert.alert('Could not create', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (b: BarberDoc): Promise<void> => {
    try {
      await updateDoc(doc(firestore, 'barbers', b.id), { active: !b.active });
    } catch (err) {
      Alert.alert('Could not update', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Barbers</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {barbers.map((b) => (
          <Card key={b.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
                  {b.displayName}
                </BodyText>
                <MutedText>
                  {b.serviceIds.length} service(s) · {b.active ? 'Active' : 'Inactive'}
                </MutedText>
              </View>
              <Pressable onPress={() => void toggleActive(b)}>
                <BodyText style={{ color: b.active ? '#B91C1C' : '#15803D', fontWeight: font.weight.semibold }}>
                  {b.active ? 'Deactivate' : 'Activate'}
                </BodyText>
              </Pressable>
            </View>
          </Card>
        ))}

        <Heading level={3} style={{ marginTop: spacing.lg }}>Add barber</Heading>
        <Card style={{ gap: spacing.sm }}>
          <Input label="Display name" value={name} onChangeText={setName} />
          <Input
            label="User uid (their Firebase Auth uid)"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />
          <MutedText>Services</MutedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {services
              .filter((s) => s.active)
              .map((s) => (
                <Pill
                  key={s.id}
                  label={s.name}
                  selected={selected.has(s.id)}
                  onPress={() => {
                    const next = new Set(selected);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    setSelected(next);
                  }}
                />
              ))}
          </View>
          <Button title="Create" onPress={create} loading={busy} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
