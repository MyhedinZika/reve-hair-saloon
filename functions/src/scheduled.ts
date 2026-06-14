import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { REMINDER_MINUTES_BEFORE } from '@salon/shared';
import { collections } from './db';
import { sendNotification } from './notifications';
import { cleanupScheduleOptions, reminderScheduleOptions } from './region';

const MIN_MS = 60 * 1000;

export const sendReminders = onSchedule(reminderScheduleOptions, async () => {
  const now = Date.now();
  const windowStart = now + (REMINDER_MINUTES_BEFORE - 5) * MIN_MS;
  const windowEnd = now + (REMINDER_MINUTES_BEFORE + 5) * MIN_MS;

  const snap = await collections
    .appointments()
    .where('status', '==', 'confirmed')
    .where('startAt', '>=', windowStart)
    .where('startAt', '<', windowEnd)
    .get();

  let sent = 0;
  for (const doc of snap.docs) {
    const a = doc.data();
    if (a.reminderSentAt) continue;
    if (a.clientId) {
      await sendNotification({
        recipientUid: a.clientId,
        title: 'Appointment in 1 hour',
        body: 'See you soon.',
        kind: 'reminder',
        appointmentId: a.id,
      });
    }
    await doc.ref.update({ reminderSentAt: now });
    sent++;
  }

  logger.info('Reminders processed', { candidates: snap.size, sent });
});

export const retentionCleanup = onSchedule(cleanupScheduleOptions, async () => {
  const now = Date.now();

  const expired = await collections.appointments().where('deleteAt', '<=', now).limit(500).get();

  let appointmentsDeleted = 0;
  let messagesDeleted = 0;
  let claimsDeleted = 0;

  for (const doc of expired.docs) {
    const a = doc.data();

    const msgs = await collections.messages().where('appointmentId', '==', a.id).get();
    for (const m of msgs.docs) {
      await m.ref.delete();
      messagesDeleted++;
    }

    for (const slotId of a.slotClaimIds ?? []) {
      await collections.slotClaims().doc(slotId).delete();
      claimsDeleted++;
    }

    await doc.ref.delete();
    appointmentsDeleted++;
  }

  logger.info('Retention cleanup done', { appointmentsDeleted, messagesDeleted, claimsDeleted });
});
