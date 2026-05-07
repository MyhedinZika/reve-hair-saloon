import { httpsCallable } from 'firebase/functions';
import type {
  AppointmentDoc,
  BlockUserInput,
  CancelAppointmentInput,
  CreateAppointmentInput,
  GetAvailableSlotsInput,
  GetAvailableSlotsOutput,
  MarkStatusInput,
  NextAvailableInput,
  NextAvailableOutput,
  RescheduleAppointmentInput,
  UpdateBreaksInput,
  UpdateWorkingHoursInput,
} from '@salon/shared';
import { functions } from '../config/firebase';

function callable<I, O>(name: string): (data: I) => Promise<O> {
  const fn = httpsCallable<I, O>(functions, name);
  return async (data: I) => {
    const result = await fn(data);
    return result.data;
  };
}

export const api = {
  getAvailableSlots: callable<GetAvailableSlotsInput, GetAvailableSlotsOutput>('getAvailableSlots'),
  nextAvailable: callable<NextAvailableInput, NextAvailableOutput>('nextAvailable'),
  createAppointment: callable<CreateAppointmentInput, { appointmentId: string }>(
    'createAppointment',
  ),
  cancelAppointment: callable<CancelAppointmentInput, { ok: true }>('cancelAppointment'),
  rescheduleAppointment: callable<RescheduleAppointmentInput, { appointmentId: string }>(
    'rescheduleAppointment',
  ),
  updateWorkingHours: callable<UpdateWorkingHoursInput, { ok: true }>('updateWorkingHours'),
  updateBreaks: callable<UpdateBreaksInput, { ok: true }>('updateBreaks'),
  blockUser: callable<BlockUserInput, { ok: true }>('blockUser'),
  unblockUser: callable<{ uid: string }, { ok: true }>('unblockUser'),
  markStatus: callable<MarkStatusInput, { ok: true }>('markStatus'),
  exportClientHistory: callable<void, { appointments: AppointmentDoc[] }>('exportClientHistory'),
  todayDate: callable<void, { date: string }>('todayDate'),
};
