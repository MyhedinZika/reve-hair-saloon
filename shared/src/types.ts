import type { DayOfWeek } from './constants';

export type Role = 'client' | 'barber' | 'admin';

export type AppointmentStatus =
  | 'confirmed'
  | 'completed'
  | 'cancelledByClient'
  | 'cancelledByAdmin'
  | 'noShow';

export interface UserDoc {
  uid: string;
  role: Role;
  displayName: string;
  email: string | null;
  phone: string | null;
  fcmToken: string | null;
  createdAt: number;
}

export interface BarberDoc {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  serviceIds: string[];
  active: boolean;
  createdAt: number;
}

export interface ServiceDoc {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  active: boolean;
  createdAt: number;
}

export interface TimeBlock {
  start: string;
  end: string;
}

export interface WorkingHoursDoc {
  id: string;
  barberId: string;
  dayOfWeek: DayOfWeek;
  blocks: TimeBlock[];
  updatedAt: number;
}

export interface BreakDoc {
  id: string;
  barberId: string;
  date: string;
  blocks: TimeBlock[];
  updatedAt: number;
}

export interface TimeOffDoc {
  id: string;
  barberId: string;
  startAt: number;
  endAt: number;
  reason: string | null;
  createdAt: number;
}

export interface SlotClaimDoc {
  id: string;
  barberId: string;
  startAt: number;
  appointmentId: string;
  createdAt: number;
}

export interface GuestClient {
  name: string;
  phone: string;
}

export interface AppointmentDoc {
  id: string;
  clientId: string | null;
  guestClient: GuestClient | null;
  barberId: string;
  serviceIds: string[];
  startAt: number;
  endAt: number;
  durationMinutes: number;
  status: AppointmentStatus;
  slotClaimIds: string[];
  reminderSentAt: number | null;
  createdAt: number;
  createdBy: string;
  deleteAt: number;
}

export interface MessageDoc {
  id: string;
  appointmentId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface BlockedUserDoc {
  id: string;
  uid: string;
  blockedAt: number;
  blockedBy: string;
  reason: string | null;
}

export interface NotificationDoc {
  id: string;
  recipientUid: string;
  title: string;
  body: string;
  kind: 'bookingConfirmed' | 'bookingCancelled' | 'reminder' | 'chat';
  appointmentId: string | null;
  read: boolean;
  createdAt: number;
}

export interface SettingsDoc {
  salonName: string;
  address: string;
  phone: string;
  contactEmail: string;
  timezone: string;
  bookingHorizonDays: number;
  cancellationWindowHours: number;
  defaultWorkingHoursTemplate: Record<DayOfWeek, TimeBlock[]>;
  updatedAt: number;
}

export interface CreateAppointmentInput {
  barberId: string;
  serviceIds: string[];
  startAt: number;
  guestClient?: GuestClient;
  onBehalfOfClientId?: string;
}

export interface GetAvailableSlotsInput {
  barberId: string;
  date: string;
  serviceDurationMinutes: number;
}

export interface GetAvailableSlotsOutput {
  slots: number[];
}

export interface NextAvailableInput {
  barberId: string;
  fromDate: string;
  serviceDurationMinutes: number;
}

export interface NextAvailableOutput {
  date: string | null;
  slot: number | null;
}

export interface CancelAppointmentInput {
  appointmentId: string;
}

export interface RescheduleAppointmentInput {
  appointmentId: string;
  newStartAt: number;
}

export interface MarkStatusInput {
  appointmentId: string;
  status: 'completed' | 'noShow';
}

export interface BlockUserInput {
  uid: string;
  reason?: string;
}

export interface SetUserRoleInput {
  uid: string;
  role: Role;
}

export interface UpdateWorkingHoursInput {
  barberId: string;
  dayOfWeek: DayOfWeek;
  blocks: TimeBlock[];
}

export interface UpdateBreaksInput {
  barberId: string;
  date: string;
  blocks: TimeBlock[];
}
