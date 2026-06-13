import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  type AppointmentDoc,
  type AppointmentStatus,
  type BarberDoc,
  type ServiceDoc,
} from '@salon/shared';
import {
  BodyText,
  BottomBar,
  Button,
  Card,
  Divider,
  Heading,
  IconButton,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTimeOfDay,
} from '../../util/format';
import type { ClientStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ClientStackParamList, 'AppointmentDetails'>;

export function AppointmentDetailsScreen({ navigation, route }: Props): React.JSX.Element {
  const { appointmentId } = route.params;
  const { t } = useI18n();
  const [appointment, setAppointment] = useState<AppointmentDoc | null>(null);
  const [barber, setBarber] = useState<BarberDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [windowHours, setWindowHours] = useState(DEFAULT_CANCELLATION_WINDOW_HOURS);
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = stores.watchAppointment(appointmentId, setAppointment);
    return () => unsub();
  }, [appointmentId]);

  useEffect(() => {
    Promise.all([stores.listBarbers(), stores.listServices(), stores.getSettings()]).then(
      ([bs, ss, settings]) => {
        if (settings) setWindowHours(settings.cancellationWindowHours);
        if (appointment) {
          setBarber(bs.find((b) => b.id === appointment.barberId) ?? null);
          setServices(ss.filter((s) => appointment.serviceIds.includes(s.id)));
        }
      },
    );
  }, [appointment]);

  const canCancel = useMemo(() => {
    if (!appointment) return false;
    if (appointment.status !== 'confirmed') return false;
    return appointment.startAt - Date.now() > windowHours * 60 * 60 * 1000;
  }, [appointment, windowHours]);

  const handleCancel = async (): Promise<void> => {
    if (!appointment) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancelAppointment({ appointmentId });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorCancelTitle'));
      setConfirmingCancel(false);
    } finally {
      setBusy(false);
    }
  };

  if (!appointment) {
    return (
      <Screen>
        <BodyText>{t('loading')}</BodyText>
      </Screen>
    );
  }

  const totalCents = services.reduce((acc, s) => acc + s.priceCents, 0);
  const totalMinutes = services.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <IconButton label={t('back')} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
        </IconButton>
        <View>
          <Heading level={3}>{t('appointment')}</Heading>
          <MutedText>{statusLabel(appointment.status, t)}</MutedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>{t('barber')}</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {barber?.displayName ?? '...'}
            </BodyText>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>{t('when')}</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {formatDateLong(appointment.startAt)} · {formatTimeOfDay(appointment.startAt)}
            </BodyText>
          </View>
          <Divider />
          <MutedText style={{ marginBottom: spacing.sm }}>{t('services')}</MutedText>
          {services.map((s) => (
            <View
              key={s.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <BodyText>{s.name}</BodyText>
              <BodyText>€{formatPrice(s.priceCents)}</BodyText>
            </View>
          ))}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <BodyText style={{ fontWeight: font.weight.semibold }}>{t('total')}</BodyText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              €{formatPrice(totalCents)} · {formatDuration(totalMinutes)}
            </BodyText>
          </View>
        </Card>

        {appointment.status === 'confirmed' && !canCancel ? (
          <Card style={{ marginTop: spacing.lg, backgroundColor: colors.dangerSoft }}>
            <BodyText style={{ color: colors.danger, fontWeight: font.weight.semibold }}>
              {t('cancelTooLate')}
            </BodyText>
            <MutedText style={{ marginTop: spacing.xs, color: colors.danger }}>
              {t('cancelWindowPassed', { hours: windowHours })}{' '}
              {t('callSalonUrgent')}
            </MutedText>
          </Card>
        ) : null}

        {error ? (
          <Card style={{ marginTop: spacing.lg, backgroundColor: colors.dangerSoft }}>
            <BodyText style={{ color: colors.danger, fontWeight: font.weight.semibold }}>
              {t('errorCancelTitle')}
            </BodyText>
            <MutedText style={{ color: colors.danger, marginTop: spacing.xs }}>
              {error}
            </MutedText>
          </Card>
        ) : null}
      </ScrollView>

      {appointment.status === 'confirmed' ? (
        <BottomBar>
          {confirmingCancel ? (
            <>
              <MutedText style={{ marginBottom: spacing.md, textAlign: 'center' }}>
                {t('cancelConfirmBody')}
              </MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={t('keepAppointment')}
                  variant="secondary"
                  style={{ flex: 1 }}
                  disabled={busy}
                  onPress={() => setConfirmingCancel(false)}
                />
                <Button
                  title={t('cancelBooking')}
                  variant="danger"
                  style={{ flex: 1 }}
                  loading={busy}
                  onPress={() => void handleCancel()}
                />
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Button
                  title={t('message')}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate('Chat', { appointmentId })}
                />
                <Button
                  title={t('reschedule')}
                  variant="secondary"
                  style={{ flex: 1 }}
                  disabled={!canCancel}
                  onPress={() => navigation.navigate('Reschedule', { appointmentId })}
                />
              </View>
              <Button
                title={canCancel ? t('cancelAppointment') : t('keepAppointment')}
                variant="danger"
                disabled={!canCancel || busy}
                onPress={() => {
                  setError(null);
                  setConfirmingCancel(true);
                }}
              />
            </>
          )}
        </BottomBar>
      ) : null}
    </Screen>
  );
}

function statusLabel(status: AppointmentStatus, t: ReturnType<typeof useI18n>['t']): string {
  const labels: Record<AppointmentStatus, string> = {
    confirmed: t('appointmentConfirmed'),
    completed: t('appointmentCompleted'),
    cancelledByClient: t('appointmentCancelled'),
    cancelledByAdmin: t('appointmentCancelledBySalon'),
    noShow: t('appointmentNoShow'),
  };
  return labels[status];
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
  },
});
