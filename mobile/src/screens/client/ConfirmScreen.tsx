import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BarberDoc, ServiceDoc } from '@salon/shared';
import {
  BodyText,
  Button,
  Card,
  Divider,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { font, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { formatDateLong, formatDuration, formatPrice, formatTimeOfDay } from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'Confirm'>;

export function ConfirmScreen({ navigation, route }: Props): React.JSX.Element {
  const { barberId, serviceIds, startAt } = route.params;
  const [barber, setBarber] = useState<BarberDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([stores.listBarbers(), stores.listServices()]).then(([bs, ss]) => {
      setBarber(bs.find((b) => b.id === barberId) ?? null);
      setServices(ss.filter((s) => serviceIds.includes(s.id)));
    });
  }, [barberId, serviceIds]);

  const totalCents = services.reduce((acc, s) => acc + s.priceCents, 0);
  const totalMinutes = services.reduce((acc, s) => acc + s.durationMinutes, 0);

  const confirm = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const { appointmentId } = await api.createAppointment({
        barberId,
        serviceIds,
        startAt,
      });
      navigation.replace('Confirmed', { appointmentId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create booking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Confirm booking</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>Barber</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {barber?.displayName ?? '...'}
            </BodyText>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>When</MutedText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              {formatDateLong(startAt)} · {formatTimeOfDay(startAt)}
            </BodyText>
          </View>
          <Divider />
          <MutedText style={{ marginBottom: spacing.sm }}>Services</MutedText>
          {services.map((s) => (
            <View
              key={s.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
            >
              <BodyText>{s.name}</BodyText>
              <BodyText>${formatPrice(s.priceCents)}</BodyText>
            </View>
          ))}
          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <BodyText style={{ fontWeight: font.weight.semibold }}>Total</BodyText>
            <BodyText style={{ fontWeight: font.weight.semibold }}>
              ${formatPrice(totalCents)} · {formatDuration(totalMinutes)}
            </BodyText>
          </View>
        </Card>
        {error ? (
          <BodyText style={{ marginTop: spacing.md, color: '#B91C1C' }}>{error}</BodyText>
        ) : null}
      </ScrollView>
      <View style={{ paddingVertical: spacing.lg }}>
        <Button title="Confirm booking" loading={loading} onPress={confirm} />
      </View>
    </Screen>
  );
}
