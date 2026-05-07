import { ScrollView } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Heading, Screen } from '../../theme/components';
import { spacing } from '../../theme/tokens';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Manage'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function ManageHubScreen({ navigation }: Props): React.JSX.Element {
  return (
    <Screen>
      <Heading level={2} style={{ marginBottom: spacing.lg }}>Manage</Heading>
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
