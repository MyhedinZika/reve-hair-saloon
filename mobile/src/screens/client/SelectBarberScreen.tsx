import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BarberDoc } from '@salon/shared';
import { BodyText, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'SelectBarber'>;

export function SelectBarberScreen({ navigation }: Props): React.JSX.Element {
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stores
      .listBarbers()
      .then(setBarbers)
      .catch(() => setError('Could not load barbers.'));
  }, []);

  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>
        Choose your barber
      </Heading>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        {error ? <MutedText>{error}</MutedText> : null}
        {barbers.map((b) => (
          <Pressable
            key={b.id}
            onPress={() =>
              navigation.navigate('SelectServices', { barberId: b.id })
            }
            style={({ pressed }) => ({
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.bgAlt,
                marginRight: spacing.md,
                overflow: 'hidden',
              }}
            >
              {b.avatarUrl ? (
                <Image source={{ uri: b.avatarUrl }} style={{ width: 56, height: 56 }} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <BodyText style={{ fontWeight: font.weight.semibold, fontSize: font.size.lg }}>
                {b.displayName}
              </BodyText>
              <MutedText>{b.serviceIds.length} services</MutedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
