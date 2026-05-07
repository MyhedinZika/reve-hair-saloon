import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../shared/ChatScreen';
import type { BarberStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarberStackParamList, 'Chat'>;

export function BarberChatScreen({ route }: Props): React.JSX.Element {
  return <ChatScreen appointmentId={route.params.appointmentId} />;
}
