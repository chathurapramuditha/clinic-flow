import type { Appointment, Therapist } from "./types";
import { todayISO } from "./schedule";

// 4 therapists: 2 permanent (full day), 2 non-permanent (part-time)
export const MOCK_THERAPISTS: Therapist[] = [
  {
    id: "t-1",
    name: "Dr. Ayesha Rahman",
    status: "permanent",
    specialty: "Sports & Orthopedic",
    initials: "AR",
    color: "teal",
    workingHours: { start: 8 * 60 + 30, end: 21 * 60 + 30, days: [0, 1, 2, 3, 4, 5, 6] },
  },
  {
    id: "t-2",
    name: "Dr. Marcus Chen",
    status: "permanent",
    specialty: "Neurological Rehab",
    initials: "MC",
    color: "sky",
    workingHours: { start: 8 * 60 + 30, end: 21 * 60 + 30, days: [0, 1, 2, 3, 4, 5, 6] },
  },
  {
    id: "t-3",
    name: "Dr. Priya Nair",
    status: "non-permanent",
    specialty: "Pediatric Physio",
    initials: "PN",
    color: "indigo",
    // Mornings only, weekdays
    workingHours: { start: 9 * 60, end: 13 * 60 + 30, days: [1, 2, 3, 4, 5] },
  },
  {
    id: "t-4",
    name: "Dr. Samuel Okafor",
    status: "non-permanent",
    specialty: "Geriatric Care",
    initials: "SO",
    color: "cyan",
    // Evenings, Mon/Wed/Fri
    workingHours: { start: 15 * 60, end: 21 * 60 + 30, days: [1, 3, 5] },
  },
];

const today = todayISO();

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "a-1",
    patientName: "Elena Vasquez",
    patientPhone: "+1 555-0142",
    reason: "Lower back pain assessment",
    therapistId: "t-1",
    date: today,
    slotKey: "09:15",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a-2",
    patientName: "James O'Brien",
    patientPhone: "+1 555-0189",
    reason: "Post-ACL recovery, week 3",
    therapistId: "t-2",
    date: today,
    slotKey: "10:45",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a-3",
    patientName: "Hana Ito",
    patientPhone: "+1 555-0221",
    reason: "Pediatric gait training",
    therapistId: "t-3",
    date: today,
    slotKey: "11:30",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a-4",
    patientName: "Robert Klein",
    patientPhone: "+1 555-0304",
    reason: "Balance & fall prevention",
    therapistId: "t-4",
    date: today,
    slotKey: "16:30",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a-5",
    patientName: "Chloé Bernard",
    patientPhone: "+1 555-0177",
    reason: "Shoulder mobility follow-up",
    therapistId: "t-1",
    date: today,
    slotKey: "14:15",
    createdAt: new Date().toISOString(),
  },
];
