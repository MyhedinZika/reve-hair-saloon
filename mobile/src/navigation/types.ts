import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type BookingStackParamList = {
  Book: { barberId?: string } | undefined;
  Confirmed: { appointmentId: string };
};

export type ClientTabParamList = {
  Home: undefined;
  Appointments: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type ClientStackParamList = {
  Tabs: NavigatorScreenParams<ClientTabParamList>;
  BookingFlow: NavigatorScreenParams<BookingStackParamList>;
  AppointmentDetails: { appointmentId: string };
  Chat: { appointmentId: string };
  Reschedule: { appointmentId: string };
};

export type BarberTabParamList = {
  Schedule: undefined;
  Hours: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type BarberStackParamList = {
  Tabs: NavigatorScreenParams<BarberTabParamList>;
  AppointmentDetails: { appointmentId: string };
  Chat: { appointmentId: string };
  ManageHours: undefined;
  ManageBreaks: undefined;
};

type AdminDetailParams = {
  AppointmentDetails: { appointmentId: string };
  Chat: { appointmentId: string };
};

export type AdminDashboardStackParamList = {
  Dashboard: undefined;
};

export type AdminAppointmentsStackParamList = AdminDetailParams & {
  AppointmentsList: undefined;
};

export type AdminManageStackParamList = {
  ManageHub: undefined;
  ManageBarbers: undefined;
  ManageBarberHours: { barberId: string; barberName: string };
  ManageServices: undefined;
  ManageSettings: undefined;
  ManageBlocked: undefined;
  CreateAppointment: undefined;
};

export type AdminInboxStackParamList = AdminDetailParams & {
  Inbox: undefined;
};

export type AdminTabParamList = {
  Dashboard: NavigatorScreenParams<AdminDashboardStackParamList>;
  Appointments: NavigatorScreenParams<AdminAppointmentsStackParamList>;
  Manage: NavigatorScreenParams<AdminManageStackParamList>;
  Inbox: NavigatorScreenParams<AdminInboxStackParamList>;
  Profile: undefined;
};
