import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  RETENTION_DAYS,
  MAX_DAILY_BOOKINGS_PER_CLIENT,
  SLOT_MINUTES,
  addDaysToDateString,
  dateStringFromUtcMs,
  endOfDayUtcMs,
  expectedSlotStartsForBooking,
  slotKey,
  startOfDayUtcMs,
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
} from '@salon/shared';
import { collections, db } from './db';
import { requireCaller, type CallerContext } from './auth';
import { loadAvailability } from './availability';
import { getSettings } from './settings';
import { sendNotification } from './notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

function ensureValidDuration(serviceIds: string[], durations: Map<string, number>): number {
  let total = 0;
  for (const id of serviceIds) {
    const d = durations.get(id);
    if (!d) throw new HttpsError('not-found', `Service not found: ${id}`);
    if (d % SLOT_MINUTES !== 0) {
      throw new HttpsError('failed-precondition', `Service ${id} duration not a 30-min multiple.`);
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

  let clientId: string | null;
  let guestClient: AppointmentDoc['guestClient'];

  if (isAdmin) {
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
      throw new HttpsError('permission-denied', 'Only admins can book on behalf of others.');
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
  if (!isAdmin) {
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

  if (clientId && !isAdmin) {
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

  const appointment = await db().runTransaction(async (tx) => {
    const claimSnaps = await Promise.all(claimRefs.map((r) => tx.get(r)));
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
      title: 'Booking confirmed',
      body: 'Your appointment is set.',
      kind: 'bookingConfirmed',
      appointmentId: appointmentRef.id,
    });
  }

  const barberSnap = await collections.barbers().doc(input.barberId).get();
  const barberUserId = barberSnap.data()?.userId;
  if (barberUserId && barberUserId !== clientId && barberUserId !== ctx.uid) {
    await sendNotification({
      recipientUid: barberUserId,
      title: 'New appointment',
      body: 'A client just booked with you.',
      kind: 'bookingConfirmed',
      appointmentId: appointmentRef.id,
    });
  }

  return { appointmentId: appointmentRef.id, appointment };
}

export const getAvailableSlots = onCall<GetAvailableSlotsInput, Promise<GetAvailableSlotsOutput>>(
  async (request) => {
    await requireCaller(request);
    const { barberId, date, serviceDurationMinutes } = request.data;
    if (!barberId || !date || !serviceDurationMinutes) {
      throw new HttpsError('invalid-argument', 'Missing required fields.');
    }
    const slots = await loadAvailability({ barberId, date, serviceDurationMinutes });
    return { slots };
  },
);

export const nextAvailable = onCall<NextAvailableInput, Promise<NextAvailableOutput>>(
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

    for (const id of data.slotClaimIds) {
      tx.delete(collections.slotClaims().doc(id));
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
        title: 'Appointment cancelled',
        body: 'Your appointment was cancelled.',
        kind: 'bookingCancelled',
        appointmentId,
      });
    }
    const barberUserId = barberSnap.data()?.userId;
    if (barberUserId && barberUserId !== ctx.uid) {
      await sendNotification({
        recipientUid: barberUserId,
        title: 'Appointment cancelled',
        body: 'A client cancelled their appointment.',
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
>(async (request) => {
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

  const result = await createAppointmentInternal(ctx, rebookInput);
  return { appointmentId: result.appointmentId };
});

export const todayDate = onCall<void, Promise<{ date: string }>>(async (request) => {
  await requireCaller(request);
  return { date: todayDateString() };
});

export type { Role };
