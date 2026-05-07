import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  SALON_TIMEZONE,
  type SettingsDoc,
} from '@salon/shared';
import { SETTINGS_DOC_ID, collections } from './db';

const DEFAULTS: SettingsDoc = {
  salonName: 'Salon',
  address: '',
  phone: '',
  contactEmail: '',
  timezone: SALON_TIMEZONE,
  bookingHorizonDays: DEFAULT_BOOKING_HORIZON_DAYS,
  cancellationWindowHours: DEFAULT_CANCELLATION_WINDOW_HOURS,
  defaultWorkingHoursTemplate: {
    mon: [{ start: '09:00', end: '17:00' }],
    tue: [{ start: '09:00', end: '17:00' }],
    wed: [{ start: '09:00', end: '17:00' }],
    thu: [{ start: '09:00', end: '17:00' }],
    fri: [{ start: '09:00', end: '17:00' }],
    sat: [{ start: '09:00', end: '14:00' }],
    sun: [],
  },
  updatedAt: 0,
};

export async function getSettings(): Promise<SettingsDoc> {
  const snap = await collections.settings().doc(SETTINGS_DOC_ID).get();
  const data = snap.data();
  if (!data) return DEFAULTS;
  return data;
}
