import { SLOT_MINUTES } from './constants';
import {
  alignToSlotMs,
  startOfDayUtcMs,
  timeBlockToUtcRange,
} from './time';
import type { TimeBlock } from './types';

const SLOT_MS = SLOT_MINUTES * 60 * 1000;

export interface Range {
  startMs: number;
  endMs: number;
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function subtractRanges(base: Range[], subtract: Range[]): Range[] {
  let result = [...base];
  for (const cut of subtract) {
    const next: Range[] = [];
    for (const r of result) {
      if (!rangesOverlap(r, cut)) {
        next.push(r);
        continue;
      }
      if (cut.startMs > r.startMs) {
        next.push({ startMs: r.startMs, endMs: Math.min(r.endMs, cut.startMs) });
      }
      if (cut.endMs < r.endMs) {
        next.push({ startMs: Math.max(r.startMs, cut.endMs), endMs: r.endMs });
      }
    }
    result = next.filter((r) => r.endMs > r.startMs);
  }
  return result;
}

export function workingBlocksToRanges(date: string, blocks: TimeBlock[]): Range[] {
  return blocks.map((b) => {
    const { startMs, endMs } = timeBlockToUtcRange(date, b.start, b.end);
    return { startMs, endMs };
  });
}

export interface ComputeSlotsArgs {
  date: string;
  workingBlocks: TimeBlock[];
  breakBlocks: TimeBlock[];
  appointmentRanges: Range[];
  timeOffRanges: Range[];
  serviceDurationMinutes: number;
  nowMs: number;
}

export function computeAvailableSlots(args: ComputeSlotsArgs): number[] {
  const {
    date,
    workingBlocks,
    breakBlocks,
    appointmentRanges,
    timeOffRanges,
    serviceDurationMinutes,
    nowMs,
  } = args;

  if (serviceDurationMinutes <= 0) return [];

  const working = workingBlocksToRanges(date, workingBlocks);
  const breaks = workingBlocksToRanges(date, breakBlocks);
  const blocked = [...breaks, ...appointmentRanges, ...timeOffRanges];
  const available = subtractRanges(working, blocked);

  // Slots are still claimed in SLOT_MINUTES chunks, so a service shorter
  // than a slot still blocks one full slot from the schedule's view.
  const blockedDurationMs = Math.max(SLOT_MS, Math.ceil(serviceDurationMinutes / SLOT_MINUTES) * SLOT_MS);
  const slots: number[] = [];

  for (const range of available) {
    const aligned = alignToSlotMs(range.startMs);
    const start = aligned < range.startMs ? aligned + SLOT_MS : aligned;
    for (let t = start; t + blockedDurationMs <= range.endMs; t += SLOT_MS) {
      if (t < nowMs) continue;
      slots.push(t);
    }
  }

  slots.sort((a, b) => a - b);
  return slots;
}

/**
 * Returns every 30-min slot start within the day's working hours, split into
 * `available` (bookable for the given service duration) and `unavailable`
 * (working hour but blocked by an existing booking, break, time-off, past
 * time, or not enough room for the service). Used to render a strikethrough
 * grid where booked slots stay visible.
 */
export function computeDaySchedule(args: ComputeSlotsArgs): {
  available: number[];
  unavailable: number[];
} {
  const available = new Set(computeAvailableSlots(args));
  const working = workingBlocksToRanges(args.date, args.workingBlocks);
  const all: number[] = [];
  for (const range of working) {
    const aligned = alignToSlotMs(range.startMs);
    const start = aligned < range.startMs ? aligned + SLOT_MS : aligned;
    for (let t = start; t < range.endMs; t += SLOT_MS) {
      if (t < args.nowMs) continue;
      all.push(t);
    }
  }
  const unavailable = all.filter((t) => !available.has(t)).sort((a, b) => a - b);
  return {
    available: Array.from(available).sort((a, b) => a - b),
    unavailable,
  };
}

export function expectedSlotStartsForBooking(
  startMs: number,
  durationMinutes: number,
): number[] {
  if (durationMinutes <= 0) {
    throw new Error(`Invalid duration: ${durationMinutes}`);
  }
  const count = Math.ceil(durationMinutes / SLOT_MINUTES);
  const slots: number[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(startMs + i * SLOT_MS);
  }
  return slots;
}

export function dayRange(date: string): Range {
  return {
    startMs: startOfDayUtcMs(date),
    endMs: startOfDayUtcMs(date) + 24 * 60 * 60 * 1000,
  };
}
