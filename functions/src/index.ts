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
  updateRecurringBreaks,
  blockUser,
  unblockUser,
  markStatus,
  setUserRole,
  exportClientHistory,
  deleteMyAccount,
} from './admin';

export { sendReminders, retentionCleanup } from './scheduled';
