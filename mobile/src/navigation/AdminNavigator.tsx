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
import { useI18n } from '../i18n/I18nContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors, font } from '../theme/tokens';
import { TabIcon } from './TabIcon';
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
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.ink,
  headerTitleStyle: {
    color: colors.ink,
    fontWeight: font.weight.semibold,
    fontSize: font.size.xl,
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
        options={{ headerShown: false }}
      />
    </DashboardStack.Navigator>
  );
}

function AppointmentsStackNav(): React.JSX.Element {
  const { t } = useI18n();

  return (
    <AppointmentsStack.Navigator screenOptions={stackScreenOptions}>
      <AppointmentsStack.Screen
        name="AppointmentsList"
        component={AdminAppointmentsScreen}
        options={{ headerShown: false }}
      />
      <AppointmentsStack.Screen
        name="AppointmentDetails"
        component={AdminAppointmentDetailsScreen}
        options={{ title: t('appointment') }}
      />
      <AppointmentsStack.Screen
        name="Chat"
        component={AdminChatScreen}
        options={{ title: t('chat') }}
      />
    </AppointmentsStack.Navigator>
  );
}

function ManageStackNav(): React.JSX.Element {
  const { t } = useI18n();

  return (
    <ManageStack.Navigator screenOptions={stackScreenOptions}>
      <ManageStack.Screen
        name="ManageHub"
        component={ManageHubScreen}
        options={{ headerShown: false }}
      />
      <ManageStack.Screen
        name="ManageBarbers"
        component={ManageBarbersScreen}
        options={{ title: t('barbers') }}
      />
      <ManageStack.Screen
        name="ManageBarberHours"
        component={ManageBarberHoursScreen}
        options={({ route }) => ({ title: t('barberHoursTitle', { name: route.params.barberName }) })}
      />
      <ManageStack.Screen
        name="ManageServices"
        component={ManageServicesScreen}
        options={{ title: t('services') }}
      />
      <ManageStack.Screen
        name="ManageSettings"
        component={ManageSettingsScreen}
        options={{ title: t('salonSettings') }}
      />
      <ManageStack.Screen
        name="ManageBlocked"
        component={ManageBlockedScreen}
        options={{ title: t('blockedUsers') }}
      />
      <ManageStack.Screen
        name="CreateAppointment"
        component={CreateAppointmentScreen}
        options={{ headerShown: false }}
      />
    </ManageStack.Navigator>
  );
}

function InboxStackNav(): React.JSX.Element {
  const { t } = useI18n();

  return (
    <InboxStack.Navigator screenOptions={stackScreenOptions}>
      <InboxStack.Screen
        name="Inbox"
        component={AdminInboxScreen}
        options={{ title: t('inbox') }}
      />
      <InboxStack.Screen
        name="AppointmentDetails"
        component={AdminAppointmentDetailsScreen}
        options={{ title: t('appointment') }}
      />
      <InboxStack.Screen
        name="Chat"
        component={AdminChatScreen}
        options={{ title: t('chat') }}
      />
    </InboxStack.Navigator>
  );
}

export function AdminNavigator(): React.JSX.Element {
  const { profile } = useAuth();
  const { t } = useI18n();
  const unread = useUnreadCount(profile?.uid ?? null);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          minHeight: 66,
          paddingTop: 7,
        },
        tabBarLabelStyle: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNav}
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="dashboard" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsStackNav}
        options={{
          title: t('appointments'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="appointments" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Manage"
        component={ManageStackNav}
        options={{
          title: t('manage'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="manage" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxStackNav}
        options={{
          title: t('inbox'),
          ...(unread > 0 ? { tabBarBadge: unread } : {}),
          tabBarIcon: ({ color, focused }) => <TabIcon name="inbox" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
