import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/client/HomeScreen';
import { BookingScreen } from '../screens/client/BookingScreen';
import { ConfirmedScreen } from '../screens/client/ConfirmedScreen';
import { AppointmentsScreen } from '../screens/client/AppointmentsScreen';
import { AppointmentDetailsScreen } from '../screens/client/AppointmentDetailsScreen';
import { RescheduleScreen } from '../screens/client/RescheduleScreen';
import { ClientChatScreen } from '../screens/client/ClientChatScreen';
import { ClientInboxScreen } from '../screens/client/ClientInboxScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors, font } from '../theme/tokens';
import type {
  BookingStackParamList,
  ClientStackParamList,
  ClientTabParamList,
} from './types';

const Tab = createBottomTabNavigator<ClientTabParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();
const BookingStack = createNativeStackNavigator<BookingStackParamList>();

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

function BookingFlow(): React.JSX.Element {
  return (
    <BookingStack.Navigator screenOptions={stackScreenOptions}>
      <BookingStack.Screen
        name="Book"
        component={BookingScreen}
        options={{ title: 'Book appointment' }}
      />
      <BookingStack.Screen
        name="Confirmed"
        component={ConfirmedScreen}
        options={{ headerShown: false }}
      />
    </BookingStack.Navigator>
  );
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Booking" component={BookingFlow} options={{ title: 'Book' }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} />
      <Tab.Screen
        name="Inbox"
        component={ClientInboxScreen}
        options={unread > 0 ? { tabBarBadge: unread } : {}}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function ClientNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
      <Stack.Screen name="Chat" component={ClientChatScreen} />
      <Stack.Screen name="Reschedule" component={RescheduleScreen} />
    </Stack.Navigator>
  );
}
