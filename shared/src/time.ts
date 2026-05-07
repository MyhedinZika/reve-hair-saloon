import { SALON_TIMEZONE, SLOT_MINUTES, type DayOfWeek, DAYS_OF_WEEK } from './constants';

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getWallClock(date: Date, timezone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Missing ${type} in formatted date`);
    const value = parseInt(part.value, 10);
    if (Number.isNaN(value)) throw new Error(`Invalid ${type}: ${part.value}`);
    return value;
  };

  let hour = get('hour');
  if (hour === 24) hour = 0;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

export function localWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string = SALON_TIMEZONE,
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i++) {
    const wc = getWallClock(new Date(guess), timezone);
    const tzAsUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess = guess + (desiredAsUtc - tzAsUtc);
  }
  return guess;
}

export function utcMsToLocalWallClock(ms: number, timezone: string = SALON_TIMEZONE): WallClock {
  return getWallClock(new Date(ms), timezone);
}

export function parseDateString(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date string: ${date}`);
  const year = parseInt(match[1] ?? '', 10);
  const month = parseInt(match[2] ?? '', 10);
  const day = parseInt(match[3] ?? '', 10);
  return { year, month, day };
}

export function parseTimeString(time: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid time string: ${time}`);
  const hour = parseInt(match[1] ?? '', 10);
  const minute = parseInt(match[2] ?? '', 10);
  if (hour < 0 || hour > 23) throw new Error(`Invalid hour: ${hour}`);
  if (minute < 0 || minute > 59) throw new Error(`Invalid minute: ${minute}`);
  return { hour, minute };
}

export function formatTimeString(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function formatDateString(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function dateStringFromUtcMs(ms: number, timezone: string = SALON_TIMEZONE): string {
  const wc = utcMsToLocalWallClock(ms, timezone);
  return formatDateString(wc.year, wc.month, wc.day);
}

export function dayOfWeekFromUtcMs(ms: number, timezone: string = SALON_TIMEZONE): DayOfWeek {
  const wc = utcMsToLocalWallClock(ms, timezone);
  const utcLocal = new Date(Date.UTC(wc.year, wc.month - 1, wc.day));
  const jsDay = utcLocal.getUTCDay();
  const idx = (jsDay + 6) % 7;
  const day = DAYS_OF_WEEK[idx];
  if (!day) throw new Error(`Invalid day of week index: ${idx}`);
  return day;
}

export function dayOfWeekFromDateString(date: string): DayOfWeek {
  const { year, month, day } = parseDateString(date);
  const utcLocal = new Date(Date.UTC(year, month - 1, day));
  const jsDay = utcLocal.getUTCDay();
  const idx = (jsDay + 6) % 7;
  const dow = DAYS_OF_WEEK[idx];
  if (!dow) throw new Error(`Invalid day of week index: ${idx}`);
  return dow;
}

export function startOfDayUtcMs(date: string, timezone: string = SALON_TIMEZONE): number {
  const { year, month, day } = parseDateString(date);
  return localWallClockToUtcMs(year, month, day, 0, 0, timezone);
}

export function endOfDayUtcMs(date: string, timezone: string = SALON_TIMEZONE): number {
  const { year, month, day } = parseDateString(date);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return localWallClockToUtcMs(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    timezone,
  );
}

export function timeBlockToUtcRange(
  date: string,
  startTime: string,
  endTime: string,
  timezone: string = SALON_TIMEZONE,
): { startMs: number; endMs: number } {
  const { year, month, day } = parseDateString(date);
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  const startMs = localWallClockToUtcMs(year, month, day, start.hour, start.minute, timezone);
  const endMs = localWallClockToUtcMs(year, month, day, end.hour, end.minute, timezone);
  return { startMs, endMs };
}

export function alignToSlotMs(ms: number): number {
  const slotMs = SLOT_MINUTES * 60 * 1000;
  return Math.floor(ms / slotMs) * slotMs;
}

export function slotKey(barberId: string, startMs: number, timezone: string = SALON_TIMEZONE): string {
  const wc = utcMsToLocalWallClock(startMs, timezone);
  const date = formatDateString(wc.year, wc.month, wc.day);
  const time = formatTimeString(wc.hour, wc.minute);
  return `${barberId}_${date}T${time}`;
}

export function addDaysToDateString(date: string, days: number): string {
  const { year, month, day } = parseDateString(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function todayDateString(timezone: string = SALON_TIMEZONE): string {
  return dateStringFromUtcMs(Date.now(), timezone);
}
