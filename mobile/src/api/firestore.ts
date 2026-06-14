import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AppointmentDoc,
  BarberDoc,
  MessageDoc,
  NotificationDoc,
  ServiceDoc,
  SettingsDoc,
} from '@salon/shared';
import { firestore } from '../config/firebase';

export const SETTINGS_DOC_ID = 'global';

/**
 * Sort services by sortOrder (lower first); services without sortOrder fall
 * to the bottom, ordered by createdAt as a stable tiebreaker.
 */
export function compareServiceOrder(a: ServiceDoc, b: ServiceDoc): number {
  const aHas = typeof a.sortOrder === 'number';
  const bHas = typeof b.sortOrder === 'number';
  if (aHas && bHas) return a.sortOrder! - b.sortOrder!;
  if (aHas) return -1;
  if (bHas) return 1;
  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

function typedDocs<T extends DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(firestore, collectionName), ...constraints);
  return getDocs(q).then((snap) => snap.docs.map((d) => d.data() as T));
}

function watchTypedDocs<T extends DocumentData>(
  collectionName: string,
  callback: (docs: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  const q = query(collection(firestore, collectionName), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => d.data() as T));
    },
    () => {
      callback([]);
    },
  );
}

export const stores = {
  listBarbers: (): Promise<BarberDoc[]> =>
    typedDocs<BarberDoc>('barbers', where('active', '==', true)),

  listServices: async (): Promise<ServiceDoc[]> => {
    const docs = await typedDocs<ServiceDoc>('services', where('active', '==', true));
    return docs.sort(compareServiceOrder);
  },

  watchClientAppointments: (
    clientId: string,
    callback: (docs: AppointmentDoc[]) => void,
  ): Unsubscribe =>
    watchTypedDocs<AppointmentDoc>(
      'appointments',
      callback,
      where('clientId', '==', clientId),
      orderBy('startAt', 'desc'),
      limit(100),
    ),

  watchBarberAppointments: (
    barberId: string,
    callback: (docs: AppointmentDoc[]) => void,
  ): Unsubscribe =>
    watchTypedDocs<AppointmentDoc>(
      'appointments',
      callback,
      where('barberId', '==', barberId),
      orderBy('startAt', 'asc'),
      limit(200),
    ),

  watchAllAppointments: (callback: (docs: AppointmentDoc[]) => void): Unsubscribe =>
    watchTypedDocs<AppointmentDoc>(
      'appointments',
      callback,
      orderBy('startAt', 'desc'),
      limit(200),
    ),

  watchAppointment: (
    id: string,
    callback: (doc: AppointmentDoc | null) => void,
  ): Unsubscribe => {
    const ref = doc(firestore, 'appointments', id);
    return onSnapshot(
      ref,
      (snap) => {
        callback(snap.exists() ? (snap.data() as AppointmentDoc) : null);
      },
      () => {
        callback(null);
      },
    );
  },

  watchMessages: (
    appointmentId: string,
    callback: (docs: MessageDoc[]) => void,
  ): Unsubscribe =>
    watchTypedDocs<MessageDoc>(
      'messages',
      callback,
      where('appointmentId', '==', appointmentId),
      orderBy('createdAt', 'asc'),
    ),

  watchNotifications: (
    recipientUid: string,
    callback: (docs: NotificationDoc[]) => void,
  ): Unsubscribe =>
    watchTypedDocs<NotificationDoc>(
      'notifications',
      callback,
      where('recipientUid', '==', recipientUid),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),

  getSettings: async (): Promise<SettingsDoc | null> => {
    const ref = doc(firestore, 'settings', SETTINGS_DOC_ID);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as SettingsDoc) : null;
  },
};
