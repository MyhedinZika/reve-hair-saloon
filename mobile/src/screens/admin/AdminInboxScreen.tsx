import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InboxScreen } from '../shared/InboxScreen';
import type { AdminInboxStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminInboxStackParamList, 'Inbox'>;

export function AdminInboxScreen({ navigation }: Props): React.JSX.Element {
  return (
    <InboxScreen
      onOpenAppointment={(appointmentId) =>
        navigation.navigate('AppointmentDetails', { appointmentId })
      }
    />
  );
}
