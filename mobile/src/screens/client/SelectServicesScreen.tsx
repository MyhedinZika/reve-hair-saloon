import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BarberDoc, ServiceDoc } from '@salon/shared';
import {
  BodyText,
  Button,
  Heading,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { formatDuration, formatPrice } from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'SelectServices'>;

export function SelectServicesScreen({ navigation, route }: Props): React.JSX.Element {
  const { barberId } = route.params;
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [barber, setBarber] = useState<BarberDoc | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    stores.listServices().then(setServices).catch(() => setServices([]));
    stores
      .listBarbers()
      .then((all) => setBarber(all.find((b) => b.id === barberId) ?? null))
      .catch(() => setBarber(null));
  }, [barberId]);

  const available = useMemo(() => {
    if (!barber) return services;
    return services.filter((s) => barber.serviceIds.includes(s.id));
  }, [barber, services]);

  const total = useMemo(() => {
    let cents = 0;
    let minutes = 0;
    for (const s of available) {
      if (selected.has(s.id)) {
        cents += s.priceCents;
        minutes += s.durationMinutes;
      }
    }
    return { cents, minutes };
  }, [available, selected]);

  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const proceed = (): void => {
    navigation.navigate('SelectDate', {
      barberId,
      serviceIds: Array.from(selected),
    });
  };

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Select services</Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.sm }}>
        {available.map((s) => {
          const isSelected = selected.has(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => toggle(s.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: isSelected ? colors.ink : colors.card,
                borderWidth: 1,
                borderColor: isSelected ? colors.ink : colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <BodyText
                  style={{
                    fontWeight: font.weight.semibold,
                    color: isSelected ? colors.inkOnAccent : colors.ink,
                    fontSize: font.size.md,
                  }}
                >
                  {s.name}
                </BodyText>
                <MutedText style={{ color: isSelected ? colors.inkOnAccent : colors.muted }}>
                  {formatDuration(s.durationMinutes)}
                </MutedText>
              </View>
              <BodyText
                style={{
                  fontWeight: font.weight.semibold,
                  color: isSelected ? colors.inkOnAccent : colors.ink,
                }}
              >
                ${formatPrice(s.priceCents)}
              </BodyText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingVertical: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
          }}
        >
          <MutedText>{formatDuration(total.minutes)}</MutedText>
          <BodyText style={{ fontWeight: font.weight.semibold }}>
            ${formatPrice(total.cents)}
          </BodyText>
        </View>
        <Button title="Continue" disabled={selected.size === 0} onPress={proceed} />
      </View>
    </Screen>
  );
}
