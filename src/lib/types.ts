// Data models. Shaped to map cleanly to future Supabase tables.

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
  name: string;
  status: TherapistStatus;
  specialty: string;
  initials: string;
  color: string; // tailwind class token, e.g. "teal"
  workingHours: WorkingHours;
};

export type Appointment = {
  id: string;
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

export type Patient = {
  id: string;
  name: string;
  phone: string;
  appointmentCount: number;
};
