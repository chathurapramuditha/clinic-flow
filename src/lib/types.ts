// Data models mirroring the Supabase schema, mapped into camelCase for the UI.

export type TherapistStatus = "permanent" | "non-permanent";

export type WorkingHours = {
  /** Minutes from midnight. */
  start: number;
  /** Minutes from midnight. */
  end: number;
  /** Days of week available: 0 Sun .. 6 Sat. */
  days: number[];
};

export type Therapist = {
  id: string;
  userId: string | null;
  name: string;
  status: TherapistStatus;
  specialty: string;
  initials: string;
  color: string;
  workingHours: WorkingHours;
};

export type Patient = {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  reason: string;
  therapistId: string;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  /** Slot key "HH:MM" */
  slotKey: string;
  createdAt: string;
};

export type AppRole = "admin" | "therapist" | "patient";
