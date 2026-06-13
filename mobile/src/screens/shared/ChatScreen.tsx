import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { AppointmentDoc, BarberDoc, MessageDoc } from '@salon/shared';
import { BodyText, Heading, IconButton, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { formatTimeOfDay } from '../../util/format';

interface ChatScreenProps {
  appointmentId: string;
}

export function ChatScreen({ appointmentId }: ChatScreenProps): React.JSX.Element {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageDoc>>(null);

  useEffect(() => {
    const unsub = stores.watchMessages(appointmentId, setMessages);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    stores.listBarbers().then(setBarbers).catch(() => setBarbers([]));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const isReadOnly = !appointment || appointment.status !== 'confirmed';
  const barber = appointment ? barbers.find((b) => b.id === appointment.barberId) : null;
  const peerName =
    profile?.role === 'client'
      ? barber?.displayName ?? t('yourBarber')
      : appointment?.guestClient?.name ?? t('client');
  const placeholder =
    profile?.role === 'client'
      ? t('messagePeer', { name: firstName(peerName) })
      : t('messageClient');

  const send = async (): Promise<void> => {
    if (!profile) return;
    const text = draft.trim();
    if (text.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const ref = collection(firestore, 'messages');
      const id = `${appointmentId}_${Date.now()}_${profile.uid.slice(0, 6)}`;
      const doc: MessageDoc = {
        id,
        appointmentId,
        senderId: profile.uid,
        text,
        createdAt: Date.now(),
      };
      await addDoc(ref, doc);
      setDraft('');
      void serverTimestamp;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('couldNotSendMessage'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen padded={false}>
      <View
        style={styles.header}
      >
        <IconButton label={t('back')} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
        </IconButton>
        <View style={{ flex: 1 }}>
          <Heading level={3}>{peerName}</Heading>
          {appointment ? (
            <MutedText>
              {t('serviceCount', { count: appointment.serviceIds.length })} · {formatTimeOfDay(appointment.startAt)}
            </MutedText>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: spacing.sm,
          }}
          renderItem={({ item }) => {
            const mine = profile && item.senderId === profile.uid;
            return (
              <View
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  backgroundColor: mine ? colors.ink : colors.card,
                  borderColor: colors.border,
                  borderWidth: mine ? 0 : 1,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                }}
              >
                <BodyText
                  style={{
                    color: mine ? colors.inkOnAccent : colors.ink,
                    fontSize: font.size.md,
                  }}
                >
                  {item.text}
                </BodyText>
                <MutedText
                  style={{
                    color: mine ? '#D9CFB6' : colors.muted,
                    fontSize: font.size.xs,
                    marginTop: 2,
                  }}
                >
                  {formatTimeOfDay(item.createdAt)}
                </MutedText>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
              <MutedText>{t('noMessages')}</MutedText>
            </View>
          }
        />

        {isReadOnly ? (
          <View
            style={{
              padding: spacing.xl,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bgAlt,
            }}
          >
            <MutedText style={{ textAlign: 'center' }}>
              {t('conversationClosed')}
            </MutedText>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.card,
              alignItems: 'flex-end',
              gap: spacing.sm,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                backgroundColor: colors.bgAlt,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: font.size.md,
                color: colors.ink,
                maxHeight: 120,
              }}
            />
            <Pressable
              onPress={send}
              disabled={sending || draft.trim().length === 0}
              style={{
                backgroundColor: colors.ink,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.pill,
                opacity: sending || draft.trim().length === 0 ? 0.5 : 1,
              }}
            >
              <BodyText style={{ color: colors.inkOnAccent, fontWeight: font.weight.semibold }}>
                {t('send')}
              </BodyText>
            </Pressable>
          </View>
        )}

        {error ? (
          <BodyText
            style={{
              color: colors.danger,
              textAlign: 'center',
              padding: spacing.sm,
            }}
          >
            {error}
          </BodyText>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
});
