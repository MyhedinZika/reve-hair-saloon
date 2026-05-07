import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarberScheduleScreen } from '../screens/barber/BarberScheduleScreen';
import { BarberAppointmentDetailsScreen } from '../screens/barber/BarberAppointmentDetailsScreen';
import { BarberChatScreen } from '../screens/barber/BarberChatScreen';
import { BarberInboxScreen } from '../screens/barber/BarberInboxScreen';
import { ManageHoursScreen } from '../screens/barber/ManageHoursScreen';
import { ManageBreaksScreen } from '../screens/barber/ManageBreaksScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors } from '../theme/tokens';
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
      <Tab.Screen name="Schedule" component={BarberScheduleScreen} />
      <Tab.Screen
        name="Inbox"
        component={BarberInboxScreen}
        options={unread > 0 ? { tabBarBadge: unread } : {}}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
    </Stack.Navigator>
  );
}
