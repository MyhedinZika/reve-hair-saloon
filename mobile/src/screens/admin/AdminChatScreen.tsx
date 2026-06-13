import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatScreen } from '../shared/ChatScreen';

type ChatParamList = {
  Chat: { appointmentId: string };
};

type Props = NativeStackScreenProps<ChatParamList, 'Chat'>;

export function AdminChatScreen({ route }: Props): React.JSX.Element {
  return <ChatScreen appointmentId={route.params.appointmentId} />;
}
