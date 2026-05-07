import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminAppointmentsScreen } from '../screens/admin/AdminAppointmentsScreen';
import { AdminAppointmentDetailsScreen } from '../screens/admin/AdminAppointmentDetailsScreen';
import { CreateAppointmentScreen } from '../screens/admin/CreateAppointmentScreen';
import { ManageHubScreen } from '../screens/admin/ManageHubScreen';
import { ManageBarbersScreen } from '../screens/admin/ManageBarbersScreen';
import { ManageServicesScreen } from '../screens/admin/ManageServicesScreen';
import { ManageSettingsScreen } from '../screens/admin/ManageSettingsScreen';
import { ManageBlockedScreen } from '../screens/admin/ManageBlockedScreen';
import { AdminChatScreen } from '../screens/admin/AdminChatScreen';
import { AdminInboxScreen } from '../screens/admin/AdminInboxScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors } from '../theme/tokens';
import type { AdminStackParamList, AdminTabParamList } from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function Tabs(): React.JSX.Element {
  const { profile } = useAuth();
  const unread = useUnreadCount(profile?.uid ?? null);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Appointments" component={AdminAppointmentsScreen} />
      <Tab.Screen name="Manage" component={ManageHubScreen} />
      <Tab.Screen
        name="Inbox"
        component={AdminInboxScreen}
        options={unread > 0 ? { tabBarBadge: unread } : {}}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AdminNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="AppointmentDetails" component={AdminAppointmentDetailsScreen} />
      <Stack.Screen name="CreateAppointment" component={CreateAppointmentScreen} />
      <Stack.Screen name="ManageBarbers" component={ManageBarbersScreen} />
      <Stack.Screen name="ManageServices" component={ManageServicesScreen} />
      <Stack.Screen name="ManageSettings" component={ManageSettingsScreen} />
      <Stack.Screen name="ManageBlocked" component={ManageBlockedScreen} />
      <Stack.Screen name="Chat" component={AdminChatScreen} />
    </Stack.Navigator>
  );
}
