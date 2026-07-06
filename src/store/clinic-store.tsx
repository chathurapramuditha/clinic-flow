import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Appointment, Therapist } from "@/lib/types";
import { MOCK_THERAPISTS } from "@/lib/mock-data";
import { keyToMinutes, SLOT_MINUTES } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ValidationResult = { ok: true } | { ok: false; error: string };

type AppointmentRow = {
  id: string;
  patient_name: string;
  patient_phone: string;
  reason: string;
  therapist_id: string;
  date: string;
  slot_key: string;
  created_at: string;
};

const rowToAppointment = (r: AppointmentRow): Appointment => ({
  id: r.id,
  patientName: r.patient_name,
  patientPhone: r.patient_phone,
  reason: r.reason,
  therapistId: r.therapist_id,
  date: r.date,
  slotKey: r.slot_key,
  createdAt: r.created_at,
});

type ClinicContextValue = {
  therapists: Therapist[];
  appointments: Appointment[];
  addAppointment: (a: Omit<Appointment, "id" | "createdAt">) => Promise<{ id: string } | null>;
  updateAppointment: (id: string, patch: Partial<Omit<Appointment, "id" | "createdAt">>) => Promise<void>;
  cancelAppointment: (id: string) => Promise<Appointment | undefined>;
  restoreAppointment: (a: Appointment) => Promise<void>;
  getTherapist: (id: string) => Therapist | undefined;
  validateBooking: (a: {
    id?: string;
    therapistId: string;
    date: string;
    slotKey: string;
  }) => ValidationResult;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [therapists] = useState<Therapist[]>(MOCK_THERAPISTS);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("date", { ascending: true });
      if (error) {
        console.error("Failed to load appointments", error);
        return;
      }
      if (!cancelled && data) {
        setAppointments((data as AppointmentRow[]).map(rowToAppointment));
      }
    })();

    const channel = supabase
      .channel("appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          setAppointments((prev) => {
            if (payload.eventType === "INSERT") {
              const row = rowToAppointment(payload.new as AppointmentRow);
              if (prev.some((a) => a.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = rowToAppointment(payload.new as AppointmentRow);
              return prev.map((a) => (a.id === row.id ? row : a));
            }
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string })?.id;
              if (!oldId) return prev;
              return prev.filter((a) => a.id !== oldId);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

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

  const addAppointment: ClinicContextValue["addAppointment"] = useCallback(async (a) => {
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_name: a.patientName,
        patient_phone: a.patientPhone,
        reason: a.reason,
        therapist_id: a.therapistId,
        date: a.date,
        slot_key: a.slotKey,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error("Could not create appointment", { description: error?.message });
      return null;
    }
    const row = rowToAppointment(data as AppointmentRow);
    setAppointments((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
    return { id: row.id };
  }, []);

  const updateAppointment: ClinicContextValue["updateAppointment"] = useCallback(
    async (id, patch) => {
      const payload: {
        patient_name?: string;
        patient_phone?: string;
        reason?: string;
        therapist_id?: string;
        date?: string;
        slot_key?: string;
      } = {};
      if (patch.patientName !== undefined) payload.patient_name = patch.patientName;
      if (patch.patientPhone !== undefined) payload.patient_phone = patch.patientPhone;
      if (patch.reason !== undefined) payload.reason = patch.reason;
      if (patch.therapistId !== undefined) payload.therapist_id = patch.therapistId;
      if (patch.date !== undefined) payload.date = patch.date;
      if (patch.slotKey !== undefined) payload.slot_key = patch.slotKey;

      const { data, error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        toast.error("Could not update appointment", { description: error.message });
        return;
      }
      if (data) {
        const row = rowToAppointment(data as AppointmentRow);
        setAppointments((prev) => prev.map((a) => (a.id === row.id ? row : a)));
      }
    },
    [],
  );

  const cancelAppointment: ClinicContextValue["cancelAppointment"] = useCallback(
    async (id) => {
      const removed = appointments.find((a) => a.id === id);
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) {
        toast.error("Could not cancel appointment", { description: error.message });
        return undefined;
      }
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      return removed;
    },
    [appointments],
  );

  const restoreAppointment: ClinicContextValue["restoreAppointment"] = useCallback(
    async (a) => {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          id: a.id,
          patient_name: a.patientName,
          patient_phone: a.patientPhone,
          reason: a.reason,
          therapist_id: a.therapistId,
          date: a.date,
          slot_key: a.slotKey,
        })
        .select()
        .single();
      if (error) {
        toast.error("Could not restore appointment", { description: error.message });
        return;
      }
      if (data) {
        const row = rowToAppointment(data as AppointmentRow);
        setAppointments((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
      }
    },
    [],
  );

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
