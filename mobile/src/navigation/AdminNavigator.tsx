import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminAppointmentsScreen } from '../screens/admin/AdminAppointmentsScreen';
import { AdminAppointmentDetailsScreen } from '../screens/admin/AdminAppointmentDetailsScreen';
import { CreateAppointmentScreen } from '../screens/admin/CreateAppointmentScreen';
import { ManageHubScreen } from '../screens/admin/ManageHubScreen';
import { ManageBarbersScreen } from '../screens/admin/ManageBarbersScreen';
import { ManageBarberHoursScreen } from '../screens/admin/ManageBarberHoursScreen';
import { ManageServicesScreen } from '../screens/admin/ManageServicesScreen';
import { ManageSettingsScreen } from '../screens/admin/ManageSettingsScreen';
import { ManageBlockedScreen } from '../screens/admin/ManageBlockedScreen';
import { AdminChatScreen } from '../screens/admin/AdminChatScreen';
import { AdminInboxScreen } from '../screens/admin/AdminInboxScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors, font } from '../theme/tokens';
import type {
  AdminAppointmentsStackParamList,
  AdminDashboardStackParamList,
  AdminInboxStackParamList,
  AdminManageStackParamList,
  AdminTabParamList,
} from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const DashboardStack = createNativeStackNavigator<AdminDashboardStackParamList>();
const AppointmentsStack = createNativeStackNavigator<AdminAppointmentsStackParamList>();
const ManageStack = createNativeStackNavigator<AdminManageStackParamList>();
const InboxStack = createNativeStackNavigator<AdminInboxStackParamList>();

const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.ink,
  headerTitleStyle: {
    color: colors.ink,
    fontWeight: font.weight.semibold,
    fontSize: font.size.lg,
  },
  headerShadowVisible: false,
  headerBackTitle: 'Back',
};

function DashboardStackNav(): React.JSX.Element {
  return (
    <DashboardStack.Navigator screenOptions={stackScreenOptions}>
      <DashboardStack.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Dashboard' }}
      />
    </DashboardStack.Navigator>
  );
}

function AppointmentsStackNav(): React.JSX.Element {
  return (
    <AppointmentsStack.Navigator screenOptions={stackScreenOptions}>
      <AppointmentsStack.Screen
        name="AppointmentsList"
        component={AdminAppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
      <AppointmentsStack.Screen
        name="AppointmentDetails"
        component={AdminAppointmentDetailsScreen}
        options={{ title: 'Appointment' }}
      />
      <AppointmentsStack.Screen
        name="Chat"
        component={AdminChatScreen}
        options={{ title: 'Chat' }}
      />
    </AppointmentsStack.Navigator>
  );
}

function ManageStackNav(): React.JSX.Element {
  return (
    <ManageStack.Navigator screenOptions={stackScreenOptions}>
      <ManageStack.Screen
        name="ManageHub"
        component={ManageHubScreen}
        options={{ title: 'Manage' }}
      />
      <ManageStack.Screen
        name="ManageBarbers"
        component={ManageBarbersScreen}
        options={{ title: 'Barbers' }}
      />
      <ManageStack.Screen
        name="ManageBarberHours"
        component={ManageBarberHoursScreen}
        options={({ route }) => ({ title: `${route.params.barberName}'s hours` })}
      />
      <ManageStack.Screen
        name="ManageServices"
        component={ManageServicesScreen}
        options={{ title: 'Services' }}
      />
      <ManageStack.Screen
        name="ManageSettings"
        component={ManageSettingsScreen}
        options={{ title: 'Settings' }}
      />
      <ManageStack.Screen
        name="ManageBlocked"
        component={ManageBlockedScreen}
        options={{ title: 'Blocked users' }}
      />
      <ManageStack.Screen
        name="CreateAppointment"
        component={CreateAppointmentScreen}
        options={{ title: 'New appointment' }}
      />
    </ManageStack.Navigator>
  );
}

function InboxStackNav(): React.JSX.Element {
  return (
    <InboxStack.Navigator screenOptions={stackScreenOptions}>
      <InboxStack.Screen
        name="Inbox"
        component={AdminInboxScreen}
        options={{ title: 'Inbox' }}
      />
      <InboxStack.Screen
        name="AppointmentDetails"
        component={AdminAppointmentDetailsScreen}
        options={{ title: 'Appointment' }}
      />
      <InboxStack.Screen
        name="Chat"
        component={AdminChatScreen}
        options={{ title: 'Chat' }}
      />
    </InboxStack.Navigator>
  );
}

export function AdminNavigator(): React.JSX.Element {
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
      <Tab.Screen name="Dashboard" component={DashboardStackNav} />
      <Tab.Screen name="Appointments" component={AppointmentsStackNav} />
      <Tab.Screen name="Manage" component={ManageStackNav} />
      <Tab.Screen
        name="Inbox"
        component={InboxStackNav}
        options={unread > 0 ? { tabBarBadge: unread } : {}}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
