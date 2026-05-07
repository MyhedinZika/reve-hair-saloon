import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import type { NotificationDoc } from '@salon/shared';
import { collections } from './db';

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

  try {
    await getMessaging().send({
      token,
      notification: { title: args.title, body: args.body },
      data: {
        kind: args.kind,
        appointmentId: args.appointmentId ?? '',
      },
    });
  } catch (err) {
    logger.warn('FCM send failed', { recipientUid: args.recipientUid, err });
  }
}
