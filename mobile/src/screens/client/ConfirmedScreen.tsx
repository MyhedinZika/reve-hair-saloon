import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BodyText, Button, Heading, Screen } from '../../theme/components';
import { colors, radius, spacing } from '../../theme/tokens';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'Confirmed'>;

export function ConfirmedScreen({ navigation }: Props): React.JSX.Element {
  const goHome = (): void => {
    navigation.popToTop();
  };

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.pill,
            backgroundColor: colors.success,
            marginBottom: spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BodyText style={{ color: '#fff', fontSize: 40 }}>✓</BodyText>
        </View>
        <Heading level={2}>Booking confirmed</Heading>
        <BodyText style={{ marginTop: spacing.md, textAlign: 'center' }}>
          We sent the details to your inbox.
        </BodyText>
      </View>
      <Button title="Done" onPress={goHome} />
    </Screen>
  );
}
