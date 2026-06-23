import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  RETENTION_DAYS,
  MAX_DAILY_BOOKINGS_PER_CLIENT,
  SLOT_MINUTES,
  addDaysToDateString,
  dateStringFromUtcMs,
  dayOfWeekFromUtcMs,
  endOfDayUtcMs,
  expectedSlotStartsForBooking,
  slotKey,
  startOfDayUtcMs,
  timeBlockToUtcRange,
  todayDateString,
  type AppointmentDoc,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type GetAvailableSlotsInput,
  type GetAvailableSlotsOutput,
  type NextAvailableInput,
  type NextAvailableOutput,
  type RescheduleAppointmentInput,
  type Role,
  type SlotClaimDoc,
  type TimeBlock,
} from '@salon/shared';
import { collections, db } from './db';
import { requireCaller, type CallerContext } from './auth';
import { loadAvailability, loadDaySchedule } from './availability';
import { getSettings } from './settings';
import { sendNotification } from './notifications';
import { callableOptions } from './region';

const DAY_MS = 24 * 60 * 60 * 1000;

function ensureValidDuration(serviceIds: string[], durations: Map<string, number>): number {
  let total = 0;
  for (const id of serviceIds) {
    const d = durations.get(id);
    if (!d) throw new HttpsError('not-found', `Service not found: ${id}`);
    if (!Number.isFinite(d) || d <= 0) {
      throw new HttpsError('failed-precondition', `Service ${id} has an invalid duration.`);
    }
    total += d;
  }
  if (total <= 0) throw new HttpsError('invalid-argument', 'No services selected.');
  return total;
}

interface CreateAppointmentResult {
  appointmentId: string;
  appointment: AppointmentDoc;
}

async function createAppointmentInternal(
  ctx: CallerContext,
  input: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  if (!input.barberId || !Array.isArray(input.serviceIds) || input.serviceIds.length === 0) {
    throw new HttpsError('invalid-argument', 'barberId and serviceIds are required.');
  }
  if (!Number.isFinite(input.startAt)) {
    throw new HttpsError('invalid-argument', 'startAt must be a number.');
  }

  const isAdmin = ctx.role === 'admin';

  // A barber can also book on behalf of others, but only against THEIR OWN
  // barber profile — verified by matching input.barberId to the barbers doc
  // whose userId === caller uid.
  let isOwnBarber = false;
  if (!isAdmin && ctx.role === 'barber') {
    const barberSnap = await collections.barbers().doc(input.barberId).get();
    if (barberSnap.exists && barberSnap.data()?.userId === ctx.uid) {
      isOwnBarber = true;
    }
  }
  const canBookForOthers = isAdmin || isOwnBarber;

  let clientId: string | null;
  let guestClient: AppointmentDoc['guestClient'];

  if (canBookForOthers) {
    if (input.onBehalfOfClientId && input.guestClient) {
      throw new HttpsError(
        'invalid-argument',
        'Provide either onBehalfOfClientId or guestClient, not both.',
      );
    }
    if (input.onBehalfOfClientId) {
      clientId = input.onBehalfOfClientId;
      guestClient = null;
    } else if (input.guestClient) {
      clientId = null;
      guestClient = input.guestClient;
    } else {
      clientId = ctx.uid;
      guestClient = null;
    }
  } else {
    if (input.onBehalfOfClientId || input.guestClient) {
      throw new HttpsError('permission-denied', 'Only admins or the assigned barber can book on behalf of others.');
    }
    clientId = ctx.uid;
    guestClient = null;
  }

  if (clientId) {
    const blocked = await collections.blockedUsers().where('uid', '==', clientId).limit(1).get();
    if (!blocked.empty) {
      throw new HttpsError('permission-denied', 'This account is blocked from booking.');
    }
  }

  const settings = await getSettings();
  const horizonMs = settings.bookingHorizonDays * DAY_MS;
  if (!canBookForOthers) {
    if (input.startAt < Date.now()) {
      throw new HttpsError('failed-precondition', 'Cannot book in the past.');
    }
    if (input.startAt > Date.now() + horizonMs) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot book more than ${settings.bookingHorizonDays} days ahead.`,
      );
    }
  }

  const serviceSnaps = await Promise.all(
    input.serviceIds.map((id) => collections.services().doc(id).get()),
  );
  const durations = new Map<string, number>();
  for (const s of serviceSnaps) {
    const data = s.data();
    if (!data || !data.active) {
      throw new HttpsError('not-found', `Service unavailable: ${s.id}`);
    }
    durations.set(s.id, data.durationMinutes);
  }
  const totalDuration = ensureValidDuration(input.serviceIds, durations);
  const endAt = input.startAt + totalDuration * 60 * 1000;

  if (clientId && !canBookForOthers) {
    const dateStr = dateStringFromUtcMs(input.startAt);
    const dayStart = startOfDayUtcMs(dateStr);
    const dayEnd = endOfDayUtcMs(dateStr);
    const sameDay = await collections
      .appointments()
      .where('clientId', '==', clientId)
      .where('startAt', '>=', dayStart)
      .where('startAt', '<', dayEnd)
      .get();
    const active = sameDay.docs.filter((d) => d.data().status === 'confirmed');
    if (active.length >= MAX_DAILY_BOOKINGS_PER_CLIENT) {
      throw new HttpsError(
        'failed-precondition',
        `Maximum ${MAX_DAILY_BOOKINGS_PER_CLIENT} bookings per day per client.`,
      );
    }
  }

  const slotStarts = expectedSlotStartsForBooking(input.startAt, totalDuration);
  const claimRefs = slotStarts.map((s) =>
    collections.slotClaims().doc(slotKey(input.barberId, s)),
  );
  const appointmentRef = collections.appointments().doc();

  const dateStr = dateStringFromUtcMs(input.startAt);
  const dayOfWeek = dayOfWeekFromUtcMs(input.startAt);
  const whRef = collections.workingHours().doc(`${input.barberId}_${dayOfWeek}`);
  const brRef = collections.breaks().doc(`${input.barberId}_${dateStr}`);

  const appointment = await db().runTransaction(async (tx) => {
    const [whSnap, brSnap, ...claimSnaps] = await Promise.all([
      tx.get(whRef),
      tx.get(brRef),
      ...claimRefs.map((r) => tx.get(r)),
    ]);

    const workingBlocks: TimeBlock[] = whSnap.data()?.blocks ?? [];
    const breakBlocks: TimeBlock[] = brSnap.data()?.blocks ?? [];

    if (workingBlocks.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'No working hours set for this day. Please choose another time.',
      );
    }

    for (const slotStart of slotStarts) {
      const slotEnd = slotStart + SLOT_MINUTES * 60 * 1000;
      const insideWorking = workingBlocks.some((b) => {
        const r = timeBlockToUtcRange(dateStr, b.start, b.end);
        return r.startMs <= slotStart && r.endMs >= slotEnd;
      });
      if (!insideWorking) {
        throw new HttpsError(
          'failed-precondition',
          'Slot is outside working hours. Please choose another time.',
        );
      }
      const overlapsBreak = breakBlocks.some((b) => {
        const r = timeBlockToUtcRange(dateStr, b.start, b.end);
        return r.startMs < slotEnd && r.endMs > slotStart;
      });
      if (overlapsBreak) {
        throw new HttpsError(
          'failed-precondition',
          'Slot overlaps a break. Please choose another time.',
        );
      }
    }

    for (const s of claimSnaps) {
      if (s.exists) {
        throw new HttpsError('aborted', 'Slot was just taken. Please choose another time.');
      }
    }

    const now = Date.now();
    const doc: AppointmentDoc = {
      id: appointmentRef.id,
      clientId,
      guestClient,
      barberId: input.barberId,
      serviceIds: input.serviceIds,
      startAt: input.startAt,
      endAt,
      durationMinutes: totalDuration,
      status: 'confirmed',
      slotClaimIds: claimRefs.map((r) => r.id),
      reminderSentAt: null,
      createdAt: now,
      createdBy: ctx.uid,
      deleteAt: input.startAt + RETENTION_DAYS * DAY_MS,
    };

    tx.set(appointmentRef, doc);

    for (let i = 0; i < claimRefs.length; i++) {
      const ref = claimRefs[i];
      const startMs = slotStarts[i];
      if (!ref || startMs === undefined) continue;
      const claim: SlotClaimDoc = {
        id: ref.id,
        barberId: input.barberId,
        startAt: startMs,
        appointmentId: appointmentRef.id,
        createdAt: now,
      };
      tx.set(ref, claim);
    }

    return doc;
  });

  if (clientId) {
    await sendNotification({
      recipientUid: clientId,
      title: 'Rezervimi u konfirmua',
      body: 'Termini yt është caktuar.',
      kind: 'bookingConfirmed',
      appointmentId: appointmentRef.id,
    });
  }

  const barberSnap = await collections.barbers().doc(input.barberId).get();
  const barberUserId = barberSnap.data()?.userId;
  if (barberUserId && barberUserId !== clientId && barberUserId !== ctx.uid) {
    await sendNotification({
      recipientUid: barberUserId,
      title: 'Termin i ri',
      body: 'Një klient sapo rezervoi me ty.',
      kind: 'bookingConfirmed',
      appointmentId: appointmentRef.id,
    });
  }

  return { appointmentId: appointmentRef.id, appointment };
}

export const getAvailableSlots = onCall<GetAvailableSlotsInput, Promise<GetAvailableSlotsOutput>>(
  callableOptions,
  async (request) => {
    await requireCaller(request);
    const { barberId, date, serviceDurationMinutes } = request.data;
    if (!barberId || !date || !serviceDurationMinutes) {
      throw new HttpsError('invalid-argument', 'Missing required fields.');
    }
    const schedule = await loadDaySchedule({ barberId, date, serviceDurationMinutes });
    return { slots: schedule.available, unavailable: schedule.unavailable };
  },
);

export const nextAvailable = onCall<NextAvailableInput, Promise<NextAvailableOutput>>(
  callableOptions,
  async (request) => {
    await requireCaller(request);
    const { barberId, fromDate, serviceDurationMinutes } = request.data;
    if (!barberId || !fromDate || !serviceDurationMinutes) {
      throw new HttpsError('invalid-argument', 'Missing required fields.');
    }
    const settings = await getSettings();
    let date = fromDate;
    for (let i = 0; i <= settings.bookingHorizonDays; i++) {
      const slots = await loadAvailability({ barberId, date, serviceDurationMinutes });
      if (slots.length > 0) {
        const slot = slots[0];
        if (slot !== undefined) return { date, slot };
      }
      date = addDaysToDateString(date, 1);
    }
    return { date: null, slot: null };
  },
);

export const createAppointment = onCall<CreateAppointmentInput, Promise<{ appointmentId: string }>>(
  callableOptions,
  async (request) => {
    const ctx = await requireCaller(request);
    const result = await createAppointmentInternal(ctx, request.data);
    return { appointmentId: result.appointmentId };
  },
);

interface CancelInternalResult {
  appointment: AppointmentDoc;
  status: 'cancelledByClient' | 'cancelledByAdmin';
}

async function cancelInternal(
  appointmentId: string,
  callerUid: string,
  cancelStatus: 'cancelledByClient' | 'cancelledByAdmin',
  enforceWindow: boolean,
): Promise<CancelInternalResult> {
  const settings = await getSettings();
  const apptRef = collections.appointments().doc(appointmentId);
  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(apptRef);
    const data = snap.data();
    if (!data) throw new HttpsError('not-found', 'Appointment not found.');
    if (data.status !== 'confirmed') {
      throw new HttpsError('failed-precondition', 'Appointment is not active.');
    }
    if (enforceWindow) {
      const cutoff = data.startAt - settings.cancellationWindowHours * 60 * 60 * 1000;
      if (Date.now() > cutoff) {
        throw new HttpsError('failed-precondition', 'Cancellation window has passed.');
      }
    }

    const claimRefs = data.slotClaimIds.map((id) => collections.slotClaims().doc(id));
    const claimSnaps = await Promise.all(claimRefs.map((r) => tx.get(r)));
    for (let i = 0; i < claimRefs.length; i++) {
      const claim = claimSnaps[i]!.data();
      if (claim && claim.appointmentId === appointmentId) {
        tx.delete(claimRefs[i]!);
      }
    }

    tx.update(apptRef, {
      status: cancelStatus,
      slotClaimIds: [],
    });

    return { ...data, status: cancelStatus, slotClaimIds: [] };
  });
  logger.info('Appointment cancelled', { appointmentId, by: callerUid });
  return { appointment: result, status: cancelStatus };
}

export const cancelAppointment = onCall<CancelAppointmentInput, Promise<{ ok: true }>>(
  callableOptions,
  async (request) => {
    const ctx = await requireCaller(request);
    const { appointmentId } = request.data;
    if (!appointmentId) throw new HttpsError('invalid-argument', 'appointmentId is required.');

    const apptSnap = await collections.appointments().doc(appointmentId).get();
    const appt = apptSnap.data();
    if (!appt) throw new HttpsError('not-found', 'Appointment not found.');

    const isAdmin = ctx.role === 'admin';
    const isOwner = appt.clientId === ctx.uid;
    const barberSnap = await collections.barbers().doc(appt.barberId).get();
    const isBarber = barberSnap.data()?.userId === ctx.uid;

    if (!isAdmin && !isOwner && !isBarber) {
      throw new HttpsError('permission-denied', 'Not allowed to cancel this appointment.');
    }

    const status: 'cancelledByClient' | 'cancelledByAdmin' =
      isAdmin || isBarber ? 'cancelledByAdmin' : 'cancelledByClient';
    const enforceWindow = !isAdmin;
    const updated = await cancelInternal(appointmentId, ctx.uid, status, enforceWindow);

    if (updated.appointment.clientId && updated.appointment.clientId !== ctx.uid) {
      await sendNotification({
        recipientUid: updated.appointment.clientId,
        title: 'Termini u anulua',
        body: 'Termini yt u anulua.',
        kind: 'bookingCancelled',
        appointmentId,
      });
    }
    const barberUserId = barberSnap.data()?.userId;
    if (barberUserId && barberUserId !== ctx.uid) {
      await sendNotification({
        recipientUid: barberUserId,
        title: 'Termini u anulua',
        body: 'Një klient anuloi terminin.',
        kind: 'bookingCancelled',
        appointmentId,
      });
    }

    return { ok: true };
  },
);

export const rescheduleAppointment = onCall<
  RescheduleAppointmentInput,
  Promise<{ appointmentId: string }>
>(callableOptions, async (request) => {
  const ctx = await requireCaller(request);
  const { appointmentId, newStartAt } = request.data;
  if (!appointmentId || !Number.isFinite(newStartAt)) {
    throw new HttpsError('invalid-argument', 'appointmentId and newStartAt are required.');
  }

  const apptSnap = await collections.appointments().doc(appointmentId).get();
  const original = apptSnap.data();
  if (!original) throw new HttpsError('not-found', 'Appointment not found.');

  const isAdmin = ctx.role === 'admin';
  const isOwner = original.clientId === ctx.uid;
  const barberSnap = await collections.barbers().doc(original.barberId).get();
  const isBarber = barberSnap.data()?.userId === ctx.uid;

  if (!isAdmin && !isOwner && !isBarber) {
    throw new HttpsError('permission-denied', 'Not allowed to reschedule.');
  }

  if (newStartAt === original.startAt) {
    throw new HttpsError(
      'invalid-argument',
      'New time is the same as the current booking. Pick a different slot.',
    );
  }

  const cancelStatus: 'cancelledByAdmin' | 'cancelledByClient' =
    isAdmin || isBarber ? 'cancelledByAdmin' : 'cancelledByClient';
  await cancelInternal(appointmentId, ctx.uid, cancelStatus, !isAdmin);

  const rebookInput: CreateAppointmentInput = {
    barberId: original.barberId,
    serviceIds: original.serviceIds,
    startAt: newStartAt,
  };
  if (original.clientId && original.clientId !== ctx.uid) {
    rebookInput.onBehalfOfClientId = original.clientId;
  }
  if (original.guestClient) {
    rebookInput.guestClient = original.guestClient;
  }

  try {
    const result = await createAppointmentInternal(ctx, rebookInput);
    return { appointmentId: result.appointmentId };
  } catch (err) {
    logger.warn('Reschedule create failed, recovering original slot', {
      appointmentId,
      err: err instanceof Error ? err.message : 'unknown',
    });
    const recovery: CreateAppointmentInput = {
      barberId: original.barberId,
      serviceIds: original.serviceIds,
      startAt: original.startAt,
    };
    if (original.clientId && original.clientId !== ctx.uid) {
      recovery.onBehalfOfClientId = original.clientId;
    }
    if (original.guestClient) {
      recovery.guestClient = original.guestClient;
    }
    try {
      await createAppointmentInternal(ctx, recovery);
      throw new HttpsError(
        'aborted',
        'Could not move the booking. Your original time has been kept.',
      );
    } catch (recoveryErr) {
      if (recoveryErr instanceof HttpsError && recoveryErr.code === 'aborted') {
        throw recoveryErr;
      }
      logger.error('Failed to recover original appointment after reschedule failure', {
        appointmentId,
        err: recoveryErr instanceof Error ? recoveryErr.message : 'unknown',
      });
      throw err;
    }
  }
});

export const todayDate = onCall<void, Promise<{ date: string }>>(callableOptions, async (request) => {
  await requireCaller(request);
  return { date: todayDateString() };
});

export type { Role };
