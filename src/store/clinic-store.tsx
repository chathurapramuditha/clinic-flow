import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Appointment, Therapist } from "@/lib/types";
import { MOCK_APPOINTMENTS, MOCK_THERAPISTS } from "@/lib/mock-data";
import { keyToMinutes, SLOT_MINUTES } from "@/lib/schedule";

type ValidationResult = { ok: true } | { ok: false; error: string };

type ClinicContextValue = {
  therapists: Therapist[];
  appointments: Appointment[];
  addAppointment: (a: Omit<Appointment, "id" | "createdAt">) => { id: string };
  updateAppointment: (id: string, patch: Partial<Omit<Appointment, "id" | "createdAt">>) => void;
  cancelAppointment: (id: string) => Appointment | undefined;
  restoreAppointment: (a: Appointment) => void;
  getTherapist: (id: string) => Therapist | undefined;
  validateBooking: (a: {
    id?: string;
    therapistId: string;
    date: string;
    slotKey: string;
  }) => ValidationResult;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

let counter = 1000;
const newId = () => `a-${++counter}`;

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [therapists] = useState<Therapist[]>(MOCK_THERAPISTS);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);

  const getTherapist = useCallback(
    (id: string) => therapists.find((t) => t.id === id),
    [therapists],
  );

  const validateBooking = useCallback<ClinicContextValue["validateBooking"]>(
    ({ id, therapistId, date, slotKey }) => {
      const therapist = therapists.find((t) => t.id === therapistId);
      if (!therapist) return { ok: false, error: "Therapist not found." };

      const dow = new Date(date + "T00:00:00").getDay();
      if (!therapist.workingHours.days.includes(dow)) {
        return { ok: false, error: `${therapist.name} does not work on this day.` };
      }
      const slotStart = keyToMinutes(slotKey);
      const slotEnd = slotStart + SLOT_MINUTES;
      if (slotStart < therapist.workingHours.start || slotEnd > therapist.workingHours.end) {
        return {
          ok: false,
          error: `Slot is outside ${therapist.name}'s working hours.`,
        };
      }
      const conflict = appointments.find(
        (a) =>
          a.id !== id &&
          a.therapistId === therapistId &&
          a.date === date &&
          a.slotKey === slotKey,
      );
      if (conflict) {
        return { ok: false, error: "Therapist is already booked for this slot." };
      }
      return { ok: true };
    },
    [appointments, therapists],
  );

  const addAppointment: ClinicContextValue["addAppointment"] = useCallback((a) => {
    const id = newId();
    setAppointments((prev) => [
      ...prev,
      { ...a, id, createdAt: new Date().toISOString() },
    ]);
    return { id };
  }, []);

  const updateAppointment: ClinicContextValue["updateAppointment"] = useCallback(
    (id, patch) => {
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [],
  );

  const cancelAppointment: ClinicContextValue["cancelAppointment"] = useCallback((id) => {
    let removed: Appointment | undefined;
    setAppointments((prev) => {
      removed = prev.find((a) => a.id === id);
      return prev.filter((a) => a.id !== id);
    });
    return removed;
  }, []);

  const restoreAppointment: ClinicContextValue["restoreAppointment"] = useCallback((a) => {
    setAppointments((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
  }, []);

  const value = useMemo<ClinicContextValue>(
    () => ({
      therapists,
      appointments,
      addAppointment,
      updateAppointment,
      cancelAppointment,
      restoreAppointment,
      getTherapist,
      validateBooking,
    }),
    [
      therapists,
      appointments,
      addAppointment,
      updateAppointment,
      cancelAppointment,
      restoreAppointment,
      getTherapist,
      validateBooking,
    ],
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used within ClinicProvider");
  return ctx;
}
