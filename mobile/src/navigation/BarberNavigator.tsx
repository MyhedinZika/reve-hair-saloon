import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarberScheduleScreen } from '../screens/barber/BarberScheduleScreen';
import { BarberAppointmentDetailsScreen } from '../screens/barber/BarberAppointmentDetailsScreen';
import { BarberChatScreen } from '../screens/barber/BarberChatScreen';
import { BarberInboxScreen } from '../screens/barber/BarberInboxScreen';
import { ManageHoursScreen } from '../screens/barber/ManageHoursScreen';
import { ManageBreaksScreen } from '../screens/barber/ManageBreaksScreen';
import { CreateAppointmentScreen } from '../screens/admin/CreateAppointmentScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors, font } from '../theme/tokens';
import { TabIcon } from './TabIcon';
import type { BarberStackParamList, BarberTabParamList } from './types';

const Tab = createBottomTabNavigator<BarberTabParamList>();
const Stack = createNativeStackNavigator<BarberStackParamList>();

function HoursScreen(): React.JSX.Element {
  return <ManageHoursScreen />;
}

function BreaksScreen(): React.JSX.Element {
  return <ManageBreaksScreen />;
}

function Tabs(): React.JSX.Element {
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
        name="Schedule"
        component={BarberScheduleScreen}
        options={{
          title: t('schedule'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="schedule" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Hours"
        component={HoursScreen}
        options={{
          title: t('hours'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="hours" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={BarberInboxScreen}
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

export function BarberNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="AppointmentDetails" component={BarberAppointmentDetailsScreen} />
      <Stack.Screen name="Chat" component={BarberChatScreen} />
      <Stack.Screen name="ManageHours" component={HoursScreen} />
      <Stack.Screen name="ManageBreaks" component={BreaksScreen} />
      <Stack.Screen name="CreateAppointment" component={CreateAppointmentScreen} />
    </Stack.Navigator>
  );
}
