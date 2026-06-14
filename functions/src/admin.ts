import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import {
  dateStringFromUtcMs,
  dayOfWeekFromUtcMs,
  endOfDayUtcMs,
  startOfDayUtcMs,
  timeBlockToUtcRange,
  type AppointmentDoc,
  type BlockUserInput,
  type BlockedUserDoc,
  type BreakDoc,
  type MarkStatusInput,
  type RecurringBreakDoc,
  type Role,
  type SetUserRoleInput,
  type UpdateBreaksInput,
  type UpdateRecurringBreaksInput,
  type UpdateWorkingHoursInput,
  type WorkingHoursDoc,
} from '@salon/shared';
import { collections, db } from './db';
import { requireCaller, requireRole } from './auth';
import { callableOptions } from './region';

interface ConflictReport {
  appointmentId: string;
  startAt: number;
  endAt: number;
}

function rangeOverlapsAny(
  startMs: number,
  endMs: number,
  appts: AppointmentDoc[],
): ConflictReport[] {
  return appts
    .filter((a) => a.status === 'confirmed' && a.startAt < endMs && a.endAt > startMs)
    .map((a) => ({ appointmentId: a.id, startAt: a.startAt, endAt: a.endAt }));
}

function blocksContain(
  date: string,
  blocks: { start: string; end: string }[],
  appt: AppointmentDoc,
): boolean {
  for (const b of blocks) {
    const { startMs, endMs } = timeBlockToUtcRange(date, b.start, b.end);
    if (appt.startAt >= startMs && appt.endAt <= endMs) return true;
  }
  return false;
}

export const updateWorkingHours = onCall<
  UpdateWorkingHoursInput,
  Promise<{ ok: true; conflicts: ConflictReport[] }>
>(callableOptions, async (request) => {
  await requireRole(request, ['admin']);
  const { barberId, dayOfWeek, blocks } = request.data;
  if (!barberId || !dayOfWeek || !Array.isArray(blocks)) {
    throw new HttpsError('invalid-argument', 'barberId, dayOfWeek, and blocks are required.');
  }

  const id = `${barberId}_${dayOfWeek}`;

  const futureAppts = await collections
    .appointments()
    .where('barberId', '==', barberId)
    .where('startAt', '>=', Date.now())
    .get();

  const conflicts: ConflictReport[] = [];
  for (const doc of futureAppts.docs) {
    const a = doc.data();
    if (a.status !== 'confirmed') continue;
    if (dayOfWeekFromUtcMs(a.startAt) !== dayOfWeek) continue;
    const dateStr = dateStringFromUtcMs(a.startAt);
    if (!blocksContain(dateStr, blocks, a)) {
      conflicts.push({ appointmentId: a.id, startAt: a.startAt, endAt: a.endAt });
    }
  }

  if (conflicts.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Working-hour change would invalidate ${conflicts.length} existing appointment(s). Cancel or reschedule them first.`,
      conflicts,
    );
  }

  const ref = collections.workingHours().doc(id);
  const doc: WorkingHoursDoc = {
    id,
    barberId,
    dayOfWeek,
    blocks,
    updatedAt: Date.now(),
  };
  await ref.set(doc);
  return { ok: true, conflicts };
});

export const updateBreaks = onCall<
  UpdateBreaksInput,
  Promise<{ ok: true; conflicts: ConflictReport[] }>
>(callableOptions, async (request) => {
  await requireRole(request, ['admin', 'barber']);
  const { barberId, date, blocks } = request.data;
  if (!barberId || !date || !Array.isArray(blocks)) {
    throw new HttpsError('invalid-argument', 'barberId, date, and blocks are required.');
  }

  const id = `${barberId}_${date}`;
  const dayStart = startOfDayUtcMs(date);
  const dayEnd = endOfDayUtcMs(date);

  const dayAppts = await collections
    .appointments()
    .where('barberId', '==', barberId)
    .where('startAt', '>=', dayStart)
    .where('startAt', '<', dayEnd)
    .get();

  const conflicts: ConflictReport[] = [];
  for (const b of blocks) {
    const { startMs, endMs } = timeBlockToUtcRange(date, b.start, b.end);
    conflicts.push(...rangeOverlapsAny(startMs, endMs, dayAppts.docs.map((d) => d.data())));
  }

  if (conflicts.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Break change conflicts with ${conflicts.length} existing appointment(s).`,
      conflicts,
    );
  }

  const doc: BreakDoc = {
    id,
    barberId,
    date,
    blocks,
    updatedAt: Date.now(),
  };
  await collections.breaks().doc(id).set(doc);
  return { ok: true, conflicts };
});

export const updateRecurringBreaks = onCall<
  UpdateRecurringBreaksInput,
  Promise<{ ok: true; conflicts: ConflictReport[] }>
>(callableOptions, async (request) => {
  await requireRole(request, ['admin', 'barber']);
  const { barberId, dayOfWeek, blocks } = request.data;
  if (!barberId || !dayOfWeek || !Array.isArray(blocks)) {
    throw new HttpsError(
      'invalid-argument',
      'barberId, dayOfWeek, and blocks are required.',
    );
  }

  // Check future confirmed appointments on this day-of-week for overlap.
  const futureAppts = await collections
    .appointments()
    .where('barberId', '==', barberId)
    .where('startAt', '>=', Date.now())
    .get();

  const conflicts: ConflictReport[] = [];
  for (const apptDoc of futureAppts.docs) {
    const a = apptDoc.data();
    if (a.status !== 'confirmed') continue;
    if (dayOfWeekFromUtcMs(a.startAt) !== dayOfWeek) continue;
    const dateStr = dateStringFromUtcMs(a.startAt);
    for (const b of blocks) {
      const { startMs, endMs } = timeBlockToUtcRange(dateStr, b.start, b.end);
      if (a.startAt < endMs && a.endAt > startMs) {
        conflicts.push({ appointmentId: a.id, startAt: a.startAt, endAt: a.endAt });
      }
    }
  }

  if (conflicts.length > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Recurring break overlaps ${conflicts.length} existing appointment(s). Cancel or reschedule them first.`,
      conflicts,
    );
  }

  const id = `${barberId}_${dayOfWeek}`;
  const doc: RecurringBreakDoc = {
    id,
    barberId,
    dayOfWeek,
    blocks,
    updatedAt: Date.now(),
  };
  await collections.recurringBreaks().doc(id).set(doc);
  return { ok: true, conflicts };
});

export const blockUser = onCall<BlockUserInput, Promise<{ ok: true }>>(callableOptions, async (request) => {
  const ctx = await requireRole(request, ['admin']);
  const { uid, reason } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');

  const ref = collections.blockedUsers().doc(uid);
  const doc: BlockedUserDoc = {
    id: uid,
    uid,
    blockedAt: Date.now(),
    blockedBy: ctx.uid,
    reason: reason ?? null,
  };
  await ref.set(doc);
  logger.info('User blocked', { uid, by: ctx.uid });
  return { ok: true };
});

export const unblockUser = onCall<{ uid: string }, Promise<{ ok: true }>>(callableOptions, async (request) => {
  await requireRole(request, ['admin']);
  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  await collections.blockedUsers().doc(uid).delete();
  return { ok: true };
});

export const markStatus = onCall<MarkStatusInput, Promise<{ ok: true }>>(callableOptions, async (request) => {
  const ctx = await requireRole(request, ['admin', 'barber']);
  const { appointmentId, status } = request.data;
  if (!appointmentId || (status !== 'completed' && status !== 'noShow')) {
    throw new HttpsError('invalid-argument', 'appointmentId and valid status are required.');
  }

  const ref = collections.appointments().doc(appointmentId);
  const snap = await ref.get();
  const data = snap.data();
  if (!data) throw new HttpsError('not-found', 'Appointment not found.');

  if (ctx.role === 'barber') {
    const barberSnap = await collections.barbers().doc(data.barberId).get();
    if (barberSnap.data()?.userId !== ctx.uid) {
      throw new HttpsError('permission-denied', 'Not your appointment.');
    }
  }

  if (data.status !== 'confirmed') {
    throw new HttpsError('failed-precondition', 'Appointment is not in confirmed state.');
  }

  await ref.update({ status });
  return { ok: true };
});

const ALLOWED_ROLES: Role[] = ['admin', 'barber', 'client'];

export const setUserRole = onCall<SetUserRoleInput, Promise<{ ok: true }>>(callableOptions, async (request) => {
  const ctx = await requireRole(request, ['admin']);
  const { uid, role } = request.data;
  if (!uid || !ALLOWED_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'uid and a valid role are required.');
  }
  if (uid === ctx.uid && role !== 'admin') {
    throw new HttpsError('failed-precondition', 'Admins cannot demote their own account.');
  }
  const ref = collections.users().doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'User not found.');
  }
  await ref.update({ role });
  logger.info('User role updated', { uid, role, by: ctx.uid });
  return { ok: true };
});

/**
 * Self-service account deletion (required by Apple App Store guideline 5.1.1).
 * Cancels future confirmed appointments (releasing slot claims), removes the
 * user's notifications inbox, deletes the users/{uid} doc, and finally deletes
 * the Firebase Auth record via the Admin SDK.
 *
 * Past appointments are anonymized (clientId nulled, status preserved) so
 * the salon's bookkeeping remains consistent. The barber's view continues to
 * show "Past client (deleted)" via the existing fallback rendering.
 */
export const deleteMyAccount = onCall<void, Promise<{ ok: true }>>(callableOptions, async (request) => {
  const ctx = await requireCaller(request);
  const uid = ctx.uid;
  const nowMs = Date.now();

  // 1. Cancel future confirmed appointments — release slot claims atomically.
  const futureSnap = await collections
    .appointments()
    .where('clientId', '==', uid)
    .where('startAt', '>=', nowMs)
    .get();
  for (const doc of futureSnap.docs) {
    const data = doc.data();
    if (data.status !== 'confirmed') continue;
    try {
      await db().runTransaction(async (tx) => {
        const ref = collections.appointments().doc(doc.id);
        const snap = await tx.get(ref);
        const cur = snap.data();
        if (!cur || cur.status !== 'confirmed') return;
        const claimRefs = cur.slotClaimIds.map((id) => collections.slotClaims().doc(id));
        const claimSnaps = await Promise.all(claimRefs.map((r) => tx.get(r)));
        for (let i = 0; i < claimRefs.length; i++) {
          const claim = claimSnaps[i]!.data();
          if (claim && claim.appointmentId === doc.id) {
            tx.delete(claimRefs[i]!);
          }
        }
        tx.update(ref, { status: 'cancelledByClient', slotClaimIds: [], clientId: null });
      });
    } catch (err) {
      logger.warn('Failed to cancel future appointment during account deletion', {
        uid,
        appointmentId: doc.id,
        err: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // 2. Anonymize past appointments (preserve bookkeeping).
  const pastSnap = await collections
    .appointments()
    .where('clientId', '==', uid)
    .where('startAt', '<', nowMs)
    .get();
  await Promise.all(
    pastSnap.docs.map((d) =>
      d.ref.update({ clientId: null }).catch(() => undefined),
    ),
  );

  // 3. Delete the user's notifications inbox.
  const notifSnap = await collections.notifications().where('recipientUid', '==', uid).get();
  await Promise.all(notifSnap.docs.map((d) => d.ref.delete().catch(() => undefined)));

  // 4. Remove blockedUsers entry if it exists.
  await collections.blockedUsers().doc(uid).delete().catch(() => undefined);

  // 5. Delete the users doc.
  await collections.users().doc(uid).delete().catch(() => undefined);

  // 6. Delete the Firebase Auth account last.
  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    // If deletion fails the user record is in a partial state; log loudly.
    logger.error('Auth deletion failed during account deletion', {
      uid,
      err: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpsError(
      'internal',
      'Account data was removed but the sign-in record could not be deleted. Contact support.',
    );
  }

  logger.info('Account deleted', { uid });
  return { ok: true };
});

export const exportClientHistory = onCall<void, Promise<{ appointments: AppointmentDoc[] }>>(
  callableOptions,
  async (request) => {
    const ctx = await requireCaller(request);
    const snap = await collections
      .appointments()
      .where('clientId', '==', ctx.uid)
      .orderBy('startAt', 'desc')
      .get();
    return { appointments: snap.docs.map((d) => d.data()) };
  },
);
