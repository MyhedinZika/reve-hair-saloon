import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import type { NotificationDoc } from '@salon/shared';
import { BodyText, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';

interface InboxScreenProps {
  onOpenAppointment?: (appointmentId: string) => void;
}

export function InboxScreen({ onOpenAppointment }: InboxScreenProps): React.JSX.Element {
  const { profile } = useAuth();
  const { t } = useI18n();
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

  const markAllRead = async (): Promise<void> => {
    const unread = items.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(firestore, 'notifications', n.id), { read: true }).catch(() => undefined),
      ),
    );
  };

  const hasUnread = items.some((n) => !n.read);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Heading level={2}>{t('notifications')}</Heading>
            <MutedText>{t('notificationsSubtitle')}</MutedText>
          </View>
          {hasUnread ? (
            <Pressable onPress={() => void markAllRead()}>
              <MutedText style={styles.markRead}>{t('markAllRead')}</MutedText>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <MutedText>{t('noNotifications')}</MutedText>
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

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  markRead: {
    color: colors.accent,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginTop: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
});
