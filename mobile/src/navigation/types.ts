import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type BookingStackParamList = {
  SelectBarber: undefined;
  SelectServices: { barberId: string };
  SelectDate: { barberId: string; serviceIds: string[] };
  SelectTime: { barberId: string; serviceIds: string[]; date: string };
  Confirm: {
    barberId: string;
    serviceIds: string[];
    startAt: number;
  };
  Confirmed: { appointmentId: string };
};

export type ClientTabParamList = {
  Home: undefined;
  Booking: NavigatorScreenParams<BookingStackParamList>;
  Appointments: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type ClientStackParamList = {
  Tabs: NavigatorScreenParams<ClientTabParamList>;
  AppointmentDetails: { appointmentId: string };
  Chat: { appointmentId: string };
  Reschedule: { appointmentId: string };
};

export type BarberTabParamList = {
  Schedule: undefined;
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

export type AdminTabParamList = {
  Dashboard: undefined;
  Appointments: undefined;
  Manage: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type AdminStackParamList = {
  Tabs: NavigatorScreenParams<AdminTabParamList>;
  AppointmentDetails: { appointmentId: string };
  CreateAppointment: undefined;
  ManageBarbers: undefined;
  ManageServices: undefined;
  ManageSettings: undefined;
  ManageBlocked: undefined;
  Chat: { appointmentId: string };
};
