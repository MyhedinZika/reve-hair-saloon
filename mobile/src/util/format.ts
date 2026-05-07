import {
  SALON_TIMEZONE,
  formatTimeString,
  utcMsToLocalWallClock,
} from '@salon/shared';

export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTimeOfDay(ms: number): string {
  const wc = utcMsToLocalWallClock(ms, SALON_TIMEZONE);
  return formatTimeString(wc.hour, wc.minute);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDateLong(ms: number): string {
  const wc = utcMsToLocalWallClock(ms, SALON_TIMEZONE);
  const utc = new Date(Date.UTC(wc.year, wc.month - 1, wc.day));
  const idx = (utc.getUTCDay() + 6) % 7;
  const weekday = WEEKDAYS[idx] ?? '';
  const month = MONTHS[wc.month - 1] ?? '';
  return `${weekday}, ${month} ${wc.day}`;
}

export function formatDateShort(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const idx = (utc.getUTCDay() + 6) % 7;
  const weekday = WEEKDAYS[idx] ?? '';
  const monthName = MONTHS[month - 1] ?? '';
  return `${weekday} ${day} ${monthName}`;
}
