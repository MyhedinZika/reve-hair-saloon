import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InboxScreen } from '../shared/InboxScreen';
import type { BarberStackParamList, BarberTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Inbox'>,
  NativeStackScreenProps<BarberStackParamList>
>;

export function BarberInboxScreen({ navigation }: Props): React.JSX.Element {
  return (
    <InboxScreen
      onOpenAppointment={(appointmentId) =>
        navigation.navigate('AppointmentDetails', { appointmentId })
      }
    />
  );
}
