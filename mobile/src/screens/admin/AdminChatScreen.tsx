import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../shared/ChatScreen';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'Chat'>;

export function AdminChatScreen({ route }: Props): React.JSX.Element {
  return <ChatScreen appointmentId={route.params.appointmentId} />;
}
