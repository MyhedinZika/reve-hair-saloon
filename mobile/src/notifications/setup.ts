import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../config/firebase';
import { expoProjectId } from '../config/env';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowAlert: true,
  }),
});

export async function registerForPushNotifications(uid: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (!granted) return;

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId: expoProjectId });
    const token = tokenResult.data;
    if (typeof token === 'string' && token.length > 0) {
      await updateDoc(doc(firestore, 'users', uid), { fcmToken: token });
    }
  } catch {
    // permission denied or hardware unavailable; in-app inbox still works
  }
}
