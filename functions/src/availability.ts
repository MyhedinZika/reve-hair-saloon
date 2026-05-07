import {
  computeAvailableSlots,
  dayOfWeekFromDateString,
  endOfDayUtcMs,
  startOfDayUtcMs,
  type Range,
  type TimeBlock,
} from '@salon/shared';
import { collections } from './db';

export interface AvailabilityArgs {
  barberId: string;
  date: string;
  serviceDurationMinutes: number;
  excludeAppointmentId?: string;
}

export async function loadAvailability(args: AvailabilityArgs): Promise<number[]> {
  const { barberId, date, serviceDurationMinutes, excludeAppointmentId } = args;

  const dayOfWeek = dayOfWeekFromDateString(date);
  const dayStart = startOfDayUtcMs(date);
  const dayEnd = endOfDayUtcMs(date);

  const [whSnap, brSnap, apSnap, toSnap] = await Promise.all([
    collections
      .workingHours()
      .where('barberId', '==', barberId)
      .where('dayOfWeek', '==', dayOfWeek)
      .limit(1)
      .get(),
    collections
      .breaks()
      .where('barberId', '==', barberId)
      .where('date', '==', date)
      .limit(1)
      .get(),
    collections
      .appointments()
      .where('barberId', '==', barberId)
      .where('startAt', '>=', dayStart)
      .where('startAt', '<', dayEnd)
      .get(),
    collections
      .timeOffs()
      .where('barberId', '==', barberId)
      .where('endAt', '>', dayStart)
      .get(),
  ]);

  const workingBlocks: TimeBlock[] = whSnap.docs[0]?.data().blocks ?? [];
  const breakBlocks: TimeBlock[] = brSnap.docs[0]?.data().blocks ?? [];

  const appointmentRanges: Range[] = apSnap.docs
    .map((d) => d.data())
    .filter((a) => {
      if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
      return a.status === 'confirmed';
    })
    .map((a) => ({ startMs: a.startAt, endMs: a.endAt }));

  const timeOffRanges: Range[] = toSnap.docs
    .map((d) => d.data())
    .filter((t) => t.startAt < dayEnd && t.endAt > dayStart)
    .map((t) => ({ startMs: t.startAt, endMs: t.endAt }));

  return computeAvailableSlots({
    date,
    workingBlocks,
    breakBlocks,
    appointmentRanges,
    timeOffRanges,
    serviceDurationMinutes,
    nowMs: Date.now(),
  });
}
