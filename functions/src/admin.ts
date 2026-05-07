import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
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
  type UpdateBreaksInput,
  type UpdateWorkingHoursInput,
  type WorkingHoursDoc,
} from '@salon/shared';
import { collections } from './db';
import { requireCaller, requireRole } from './auth';

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
>(async (request) => {
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
>(async (request) => {
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

export const blockUser = onCall<BlockUserInput, Promise<{ ok: true }>>(async (request) => {
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

export const unblockUser = onCall<{ uid: string }, Promise<{ ok: true }>>(async (request) => {
  await requireRole(request, ['admin']);
  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  await collections.blockedUsers().doc(uid).delete();
  return { ok: true };
});

export const markStatus = onCall<MarkStatusInput, Promise<{ ok: true }>>(async (request) => {
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

export const exportClientHistory = onCall<void, Promise<{ appointments: AppointmentDoc[] }>>(
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
