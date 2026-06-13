import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Screen } from '../../theme/components';
import { spacing } from '../../theme/tokens';
import type { AdminManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminManageStackParamList, 'ManageHub'>;

export function ManageHubScreen({ navigation }: Props): React.JSX.Element {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
        <Button
          title="New appointment"
          onPress={() => navigation.navigate('CreateAppointment')}
        />
        <Button
          title="Barbers"
          variant="secondary"
          onPress={() => navigation.navigate('ManageBarbers')}
        />
        <Button
          title="Services"
          variant="secondary"
          onPress={() => navigation.navigate('ManageServices')}
        />
        <Button
          title="Salon settings"
          variant="secondary"
          onPress={() => navigation.navigate('ManageSettings')}
        />
        <Button
          title="Blocked users"
          variant="secondary"
          onPress={() => navigation.navigate('ManageBlocked')}
        />
      </ScrollView>
    </Screen>
  );
}
