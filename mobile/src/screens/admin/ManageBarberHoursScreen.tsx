import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ManageHoursScreen } from '../barber/ManageHoursScreen';
import type { AdminManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminManageStackParamList, 'ManageBarberHours'>;

export function ManageBarberHoursScreen({ route }: Props): React.JSX.Element {
  return <ManageHoursScreen barberId={route.params.barberId} hideTitle />;
}
