import { logger } from 'firebase-functions';
import type { NotificationDoc } from '@salon/shared';
import { collections } from './db';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

interface SendNotificationArgs {
  recipientUid: string;
  title: string;
  body: string;
  kind: NotificationDoc['kind'];
  appointmentId: string | null;
}

export async function sendNotification(args: SendNotificationArgs): Promise<void> {
  const now = Date.now();
  const ref = collections.notifications().doc();
  const doc: NotificationDoc = {
    id: ref.id,
    recipientUid: args.recipientUid,
    title: args.title,
    body: args.body,
    kind: args.kind,
    appointmentId: args.appointmentId,
    read: false,
    createdAt: now,
  };
  await ref.set(doc);

  const userSnap = await collections.users().doc(args.recipientUid).get();
  const token = userSnap.data()?.fcmToken;
  if (!token) return;

  await sendExpoPush(token, args);
}

function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

async function sendExpoPush(token: string, args: SendNotificationArgs): Promise<void> {
  if (!isExpoPushToken(token)) {
    logger.warn('Skipping non-Expo push token', {
      recipientUid: args.recipientUid,
      tokenPrefix: token.slice(0, 16),
    });
    return;
  }

  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title: args.title,
        body: args.body,
        data: {
          kind: args.kind,
          appointmentId: args.appointmentId ?? '',
        },
      }),
    });
    const payload = await res.text();
    if (!res.ok) {
      logger.warn('Expo push send failed', {
        recipientUid: args.recipientUid,
        status: res.status,
        payload,
      });
      return;
    }
    logger.info('Expo push send queued', {
      recipientUid: args.recipientUid,
      payload,
    });
  } catch (err) {
    logger.warn('Expo push send failed', { recipientUid: args.recipientUid, err });
  }
}
