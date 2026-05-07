import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../shared/ChatScreen';
import type { ClientStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ClientStackParamList, 'Chat'>;

export function ClientChatScreen({ route }: Props): React.JSX.Element {
  return <ChatScreen appointmentId={route.params.appointmentId} />;
}
