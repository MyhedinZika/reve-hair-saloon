import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
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
import { colors, font, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { compareServiceOrder } from '../../api/firestore';
import { api } from '../../api/functions';
import { BarberAvatar } from '../../components/BarberAvatar';
import type { AdminManageStackParamList } from '../../navigation/types';

export function ManageBarbersScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<AdminManageStackParamList>>();
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmailOriginal, setEditEmailOriginal] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editServiceIds, setEditServiceIds] = useState<Set<string>>(new Set());
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    const unsubB = onSnapshot(collection(firestore, 'barbers'), (snap) => {
      setBarbers(snap.docs.map((d) => d.data() as BarberDoc));
    });
    const unsubS = onSnapshot(collection(firestore, 'services'), (snap) => {
      setServices(snap.docs.map((d) => d.data() as ServiceDoc).sort(compareServiceOrder));
    });
    return () => {
      unsubB();
      unsubS();
    };
  }, []);

  const create = async (): Promise<void> => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Missing fields', 'Display name and email are required.');
      return;
    }
    setBusy(true);
    try {
      const usersSnap = await getDocs(
        query(collection(firestore, 'users'), where('email', '==', email.trim().toLowerCase())),
      );
      if (usersSnap.empty) {
        Alert.alert(
          'User not found',
          'No account with that email. The barber must sign up first, then try again.',
        );
        return;
      }
      const userDoc = usersSnap.docs[0]!;
      const targetUid = userDoc.id;
      const ref = doc(collection(firestore, 'barbers'));
      const newDoc: BarberDoc = {
        id: ref.id,
        userId: targetUid,
        displayName: name.trim(),
        avatarUrl: null,
        serviceIds: Array.from(selected),
        active: true,
        createdAt: Date.now(),
      };
      await setDoc(ref, newDoc);
      await api.setUserRole({ uid: targetUid, role: 'barber' }).catch((err) => {
        Alert.alert(
          'Role not updated',
          `Barber was created, but their role could not be set automatically: ${
            err instanceof Error ? err.message : 'unknown'
          }. They may need to sign out and back in.`,
        );
      });
      setName('');
      setEmail('');
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

  const startEdit = async (b: BarberDoc): Promise<void> => {
    setEditingId(b.id);
    setEditName(b.displayName);
    setEditServiceIds(new Set(b.serviceIds));
    setEditAvatarUrl(b.avatarUrl ?? '');
    setEditEmail('');
    setEditEmailOriginal('');
    try {
      const userSnap = await getDoc(doc(firestore, 'users', b.userId));
      const userEmail = (userSnap.data()?.email as string | undefined) ?? '';
      setEditEmail(userEmail);
      setEditEmailOriginal(userEmail);
    } catch {
      // ignore — admin can still edit name/services without email lookup
    }
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditEmailOriginal('');
    setEditAvatarUrl('');
    setEditServiceIds(new Set());
  };

  const saveEdit = async (b: BarberDoc): Promise<void> => {
    if (!editName.trim() || !editEmail.trim()) {
      Alert.alert('Missing fields', 'Display name and email are required.');
      return;
    }
    setEditBusy(true);
    try {
      const updates: Partial<BarberDoc> = {
        displayName: editName.trim(),
        serviceIds: Array.from(editServiceIds),
        avatarUrl: editAvatarUrl.trim() ? editAvatarUrl.trim() : null,
      };
      const trimmedEmail = editEmail.trim().toLowerCase();
      if (trimmedEmail !== editEmailOriginal.trim().toLowerCase()) {
        const usersSnap = await getDocs(
          query(collection(firestore, 'users'), where('email', '==', trimmedEmail)),
        );
        if (usersSnap.empty) {
          Alert.alert(
            'User not found',
            'No account with that email. The barber must sign up first, then try again.',
          );
          return;
        }
        const newUid = usersSnap.docs[0]!.id;
        updates.userId = newUid;
        await api.setUserRole({ uid: newUid, role: 'barber' }).catch((err) => {
          Alert.alert(
            'Role not updated',
            `Barber link was reassigned, but the new user's role could not be set: ${
              err instanceof Error ? err.message : 'unknown'
            }. They may need to sign out and back in.`,
          );
        });
      }
      await updateDoc(doc(firestore, 'barbers', b.id), updates);
      cancelEdit();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEditBusy(false);
    }
  };

  const toggleEditService = (id: string): void => {
    setEditServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {barbers.map((b) => {
          const isEditing = editingId === b.id;
          return (
            <Card key={b.id} style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <BarberAvatar avatarUrl={b.avatarUrl} name={b.displayName} size={48} />
                <View style={{ flex: 1 }}>
                  <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
                    {b.displayName}
                  </BodyText>
                  <MutedText>
                    {b.serviceIds.length} service(s) · {b.active ? 'Active' : 'Inactive'}
                  </MutedText>
                </View>
                <Pressable onPress={() => void toggleActive(b)}>
                  <BodyText style={{ color: b.active ? colors.danger : colors.success, fontWeight: font.weight.semibold }}>
                    {b.active ? 'Deactivate' : 'Activate'}
                  </BodyText>
                </Pressable>
              </View>

              {isEditing ? (
                <View style={{ gap: spacing.sm }}>
                  <Input label="Display name" value={editName} onChangeText={setEditName} />
                  <Input
                    label="Email (linked user account)"
                    value={editEmail}
                    onChangeText={setEditEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <Input
                    label="Photo URL (optional)"
                    value={editAvatarUrl}
                    onChangeText={setEditAvatarUrl}
                    autoCapitalize="none"
                    placeholder="https://..."
                  />
                  <MutedText>Services</MutedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {services
                      .filter((s) => s.active)
                      .map((s) => (
                        <Pill
                          key={s.id}
                          label={s.name}
                          selected={editServiceIds.has(s.id)}
                          onPress={() => toggleEditService(s.id)}
                        />
                      ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Save"
                        loading={editBusy}
                        onPress={() => void saveEdit(b)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button title="Cancel" variant="secondary" onPress={cancelEdit} />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <Button title="Edit details" variant="secondary" onPress={() => void startEdit(b)} />
                  <Button
                    title="Edit working hours"
                    variant="secondary"
                    onPress={() =>
                      navigation.navigate('ManageBarberHours', {
                        barberId: b.id,
                        barberName: b.displayName,
                      })
                    }
                  />
                </View>
              )}
            </Card>
          );
        })}

        <Heading level={3} style={{ marginTop: spacing.lg }}>Add barber</Heading>
        <Card style={{ gap: spacing.sm }}>
          <Input label="Display name" value={name} onChangeText={setName} />
          <Input
            label="Email (must be an existing signed-up account)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
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
