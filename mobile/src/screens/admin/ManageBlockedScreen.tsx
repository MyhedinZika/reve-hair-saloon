import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import type { BlockedUserDoc, UserDoc } from '@salon/shared';
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
import { api } from '../../api/functions';

export function ManageBlockedScreen(): React.JSX.Element {
  const [items, setItems] = useState<BlockedUserDoc[]>([]);
  const [clients, setClients] = useState<UserDoc[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserDoc>>({});
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<UserDoc | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'blockedUsers'), (snap) => {
      setItems(snap.docs.map((d) => d.data() as BlockedUserDoc));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDocs(
          query(collection(firestore, 'users'), where('role', '==', 'client')),
        );
        setClients(snap.docs.map((d) => d.data() as UserDoc));
      } catch {
        setClients([]);
      }
    })();
  }, []);

  useEffect(() => {
    const missing = items
      .map((u) => u.uid)
      .filter((uid) => !(uid in usersByUid));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        missing.map(async (uid) => {
          try {
            const snap = await getDoc(doc(firestore, 'users', uid));
            return [uid, snap.data() as UserDoc | undefined] as const;
          } catch {
            return [uid, undefined] as const;
          }
        }),
      );
      if (cancelled) return;
      setUsersByUid((prev) => {
        const next = { ...prev };
        for (const [uid, user] of entries) {
          if (user) next[uid] = user;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [items, usersByUid]);

  const blockedUids = useMemo(() => new Set(items.map((u) => u.uid)), [items]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const eligible = clients.filter((c) => !blockedUids.has(c.uid));
    if (!q) return eligible.slice(0, 8);
    return eligible
      .filter((c) => {
        const name = (c.displayName ?? '').toLowerCase();
        const email = (c.email ?? '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [clients, clientSearch, blockedUids]);

  const block = async (): Promise<void> => {
    if (!selectedClient) {
      Alert.alert('Missing client', 'Search for and pick a client first.');
      return;
    }
    setBusy(true);
    try {
      const trimmedReason = reason.trim();
      await api.blockUser(
        trimmedReason
          ? { uid: selectedClient.uid, reason: trimmedReason }
          : { uid: selectedClient.uid },
      );
      setSelectedClient(null);
      setClientSearch('');
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
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {items.length === 0 ? <MutedText>No blocked users.</MutedText> : null}
        {items.map((u) => {
          const profile = usersByUid[u.uid];
          const name = profile?.displayName?.trim() || profile?.email || u.uid;
          return (
            <Card key={u.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <BodyText style={{ fontWeight: font.weight.semibold }}>{name}</BodyText>
                  {profile?.email && profile.email !== name ? (
                    <MutedText style={{ fontSize: font.size.sm }}>{profile.email}</MutedText>
                  ) : null}
                  {u.reason ? (
                    <MutedText style={{ marginTop: spacing.xs }}>{u.reason}</MutedText>
                  ) : null}
                </View>
                <Pressable onPress={() => void unblock(u.uid)}>
                  <BodyText style={{ color: colors.success, fontWeight: font.weight.semibold }}>
                    Unblock
                  </BodyText>
                </Pressable>
              </View>
            </Card>
          );
        })}

        <Heading level={3} style={{ marginTop: spacing.lg }}>Block a user</Heading>
        <Card style={{ gap: spacing.sm }}>
          {selectedClient ? (
            <View style={styles.pickedRow}>
              <View style={{ flex: 1 }}>
                <BodyText style={{ fontWeight: font.weight.semibold }}>
                  {selectedClient.displayName || selectedClient.email || selectedClient.uid}
                </BodyText>
                {selectedClient.email ? (
                  <MutedText style={{ fontSize: font.size.sm }}>{selectedClient.email}</MutedText>
                ) : null}
              </View>
              <Pressable
                onPress={() => {
                  setSelectedClient(null);
                  setClientSearch('');
                }}
              >
                <BodyText style={{ color: colors.accent, fontWeight: font.weight.semibold }}>
                  Change
                </BodyText>
              </Pressable>
            </View>
          ) : (
            <>
              <Input
                label="Search client by name or email"
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCapitalize="none"
              />
              {filteredClients.length === 0 ? (
                <MutedText>
                  {clientSearch.trim()
                    ? 'No matching client.'
                    : 'No registered clients yet.'}
                </MutedText>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  {filteredClients.map((c) => (
                    <Pressable
                      key={c.uid}
                      onPress={() => setSelectedClient(c)}
                      style={styles.clientRow}
                    >
                      <BodyText style={{ fontWeight: font.weight.semibold }}>
                        {c.displayName || '(no name)'}
                      </BodyText>
                      <MutedText style={{ fontSize: font.size.sm }}>
                        {c.email || c.phone || c.uid}
                      </MutedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
          <Input label="Reason (optional)" value={reason} onChangeText={setReason} />
          <Button title="Block" variant="danger" onPress={block} loading={busy} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clientRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
});
