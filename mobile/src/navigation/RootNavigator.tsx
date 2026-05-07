import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { ClientNavigator } from './ClientNavigator';
import { BarberNavigator } from './BarberNavigator';
import { AdminNavigator } from './AdminNavigator';
import { colors } from '../theme/tokens';

function LoadingView(): React.JSX.Element {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

export function RootNavigator(): React.JSX.Element {
  const { authUser, profile, loading } = useAuth();

  if (loading) {
    return <LoadingView />;
  }

  return (
    <NavigationContainer>
      {!authUser || !profile ? (
        <AuthNavigator />
      ) : profile.role === 'admin' ? (
        <AdminNavigator />
      ) : profile.role === 'barber' ? (
        <BarberNavigator />
      ) : (
        <ClientNavigator />
      )}
    </NavigationContainer>
  );
}
