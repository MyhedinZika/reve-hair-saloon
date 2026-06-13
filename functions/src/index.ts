import { initializeApp } from 'firebase-admin/app';

initializeApp();

export {
  getAvailableSlots,
  nextAvailable,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  todayDate,
} from './booking';

export {
  updateWorkingHours,
  updateBreaks,
  blockUser,
  unblockUser,
  markStatus,
  setUserRole,
  exportClientHistory,
} from './admin';

export { sendReminders, retentionCleanup } from './scheduled';
