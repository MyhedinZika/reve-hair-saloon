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
import { useI18n } from '../i18n/I18nContext';
import { useUnreadCount } from '../notifications/useUnreadCount';
import { colors, font } from '../theme/tokens';
import { TabIcon } from './TabIcon';
import type {
  BookingStackParamList,
  ClientStackParamList,
  ClientTabParamList,
} from './types';

const Tab = createBottomTabNavigator<ClientTabParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();
const BookingStack = createNativeStackNavigator<BookingStackParamList>();

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

function BookingFlow(): React.JSX.Element {
  return (
    <BookingStack.Navigator screenOptions={stackScreenOptions}>
      <BookingStack.Screen
        name="Book"
        component={BookingScreen}
        options={{ headerShown: false }}
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
        name="Home"
        component={HomeScreen}
        options={{
          title: t('home'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          title: t('bookings'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="appointments" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={ClientInboxScreen}
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

export function ClientNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="BookingFlow" component={BookingFlow} />
      <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
      <Stack.Screen name="Chat" component={ClientChatScreen} />
      <Stack.Screen name="Reschedule" component={RescheduleScreen} />
    </Stack.Navigator>
  );
}
