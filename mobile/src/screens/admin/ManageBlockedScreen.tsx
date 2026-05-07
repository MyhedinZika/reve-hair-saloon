import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import type { BlockedUserDoc } from '@salon/shared';
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
import { api } from '../../api/functions';

export function ManageBlockedScreen(): React.JSX.Element {
  const [items, setItems] = useState<BlockedUserDoc[]>([]);
  const [uid, setUid] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'blockedUsers'), (snap) => {
      setItems(snap.docs.map((d) => d.data() as BlockedUserDoc));
    });
    return () => unsub();
  }, []);

  const block = async (): Promise<void> => {
    if (!uid.trim()) {
      Alert.alert('Missing uid', 'Enter the user uid to block.');
      return;
    }
    setBusy(true);
    try {
      const trimmedReason = reason.trim();
      await api.blockUser(
        trimmedReason
          ? { uid: uid.trim(), reason: trimmedReason }
          : { uid: uid.trim() },
      );
      setUid('');
      setReason('');
    } catch (err) {
      Alert.alert('Could not block', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const unblock = async (target: string): Promise<void> => {
    setBusy(true);
    try {
      await api.unblockUser({ uid: target });
    } catch (err) {
      Alert.alert('Could not unblock', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Blocked users</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {items.length === 0 ? <MutedText>No blocked users.</MutedText> : null}
        {items.map((u) => (
          <Card key={u.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <BodyText style={{ fontWeight: font.weight.semibold }}>{u.uid}</BodyText>
                {u.reason ? <MutedText>{u.reason}</MutedText> : null}
              </View>
              <Pressable onPress={() => void unblock(u.uid)}>
                <BodyText style={{ color: '#15803D', fontWeight: font.weight.semibold }}>
                  Unblock
                </BodyText>
              </Pressable>
            </View>
          </Card>
        ))}

        <Heading level={3} style={{ marginTop: spacing.lg }}>Block a user</Heading>
        <Card style={{ gap: spacing.sm }}>
          <Input label="User uid" value={uid} onChangeText={setUid} autoCapitalize="none" />
          <Input label="Reason (optional)" value={reason} onChangeText={setReason} />
          <Button title="Block" variant="danger" onPress={block} loading={busy} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
