import { getFirestore, type Firestore, type CollectionReference, type DocumentData } from 'firebase-admin/firestore';
import type {
  AppointmentDoc,
  BarberDoc,
  BlockedUserDoc,
  BreakDoc,
  MessageDoc,
  NotificationDoc,
  RecurringBreakDoc,
  ServiceDoc,
  SettingsDoc,
  SlotClaimDoc,
  TimeOffDoc,
  UserDoc,
  WorkingHoursDoc,
} from '@salon/shared';

let dbInstance: Firestore | null = null;

export function db(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore();
  }
  return dbInstance;
}

function typedCollection<T extends DocumentData>(name: string): CollectionReference<T> {
  return db().collection(name) as CollectionReference<T>;
}

export const collections = {
  users: (): CollectionReference<UserDoc> => typedCollection<UserDoc>('users'),
  barbers: (): CollectionReference<BarberDoc> => typedCollection<BarberDoc>('barbers'),
  services: (): CollectionReference<ServiceDoc> => typedCollection<ServiceDoc>('services'),
  appointments: (): CollectionReference<AppointmentDoc> =>
    typedCollection<AppointmentDoc>('appointments'),
  workingHours: (): CollectionReference<WorkingHoursDoc> =>
    typedCollection<WorkingHoursDoc>('workingHours'),
  breaks: (): CollectionReference<BreakDoc> => typedCollection<BreakDoc>('breaks'),
  recurringBreaks: (): CollectionReference<RecurringBreakDoc> =>
    typedCollection<RecurringBreakDoc>('recurringBreaks'),
  timeOffs: (): CollectionReference<TimeOffDoc> => typedCollection<TimeOffDoc>('timeOffs'),
  slotClaims: (): CollectionReference<SlotClaimDoc> =>
    typedCollection<SlotClaimDoc>('slotClaims'),
  messages: (): CollectionReference<MessageDoc> => typedCollection<MessageDoc>('messages'),
  blockedUsers: (): CollectionReference<BlockedUserDoc> =>
    typedCollection<BlockedUserDoc>('blockedUsers'),
  notifications: (): CollectionReference<NotificationDoc> =>
    typedCollection<NotificationDoc>('notifications'),
  settings: (): CollectionReference<SettingsDoc> => typedCollection<SettingsDoc>('settings'),
};

export const SETTINGS_DOC_ID = 'global';
