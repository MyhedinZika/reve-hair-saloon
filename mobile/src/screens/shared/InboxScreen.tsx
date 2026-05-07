import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import type { NotificationDoc } from '@salon/shared';
import { BodyText, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';

interface InboxScreenProps {
  onOpenAppointment?: (appointmentId: string) => void;
}

export function InboxScreen({ onOpenAppointment }: InboxScreenProps): React.JSX.Element {
  const { profile } = useAuth();
  const [items, setItems] = useState<NotificationDoc[]>([]);

  useEffect(() => {
    if (!profile) return;
    const unsub = stores.watchNotifications(profile.uid, setItems);
    return () => unsub();
  }, [profile]);

  const open = async (n: NotificationDoc): Promise<void> => {
    if (!n.read) {
      try {
        await updateDoc(doc(firestore, 'notifications', n.id), { read: true });
      } catch {
        // ignore — UI keeps showing as unread, will retry next time
      }
    }
    if (n.appointmentId && onOpenAppointment) {
      onOpenAppointment(n.appointmentId);
    }
  };

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Inbox</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.sm }}>
        {items.length === 0 ? (
          <MutedText>No notifications yet.</MutedText>
        ) : null}
        {items.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => void open(n)}
            style={({ pressed }) => ({
              backgroundColor: n.read ? colors.card : colors.bgAlt,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!n.read ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.accent,
                    marginRight: spacing.sm,
                  }}
                />
              ) : null}
              <BodyText
                style={{
                  fontWeight: n.read ? font.weight.medium : font.weight.semibold,
                  flex: 1,
                }}
              >
                {n.title}
              </BodyText>
            </View>
            <MutedText style={{ marginTop: spacing.xs }}>{n.body}</MutedText>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
