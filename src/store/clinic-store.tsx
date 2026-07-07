import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Appointment, Patient, Therapist, TherapistStatus } from "@/lib/types";
import { keyToMinutes, SLOT_MINUTES, SLOTS } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

type ValidationResult = { ok: true } | { ok: false; error: string };

type TherapistRow = {
  id: string;
  user_id: string | null;
  name: string;
  status: string;
  specialty: string;
  initials: string;
  color: string;
  work_start: number;
  work_end: number;
  work_days: number[];
  sort_order: number;
};

type PatientRow = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
};

type AppointmentRow = {
  id: string;
  patient_id: string;
  therapist_id: string;
  date: string;
  slot_key: string;
  reason: string;
  created_at: string;
};

const rowToTherapist = (r: TherapistRow): Therapist => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  status: (r.status as TherapistStatus) ?? "permanent",
  specialty: r.specialty,
  initials: r.initials,
  color: r.color,
  workingHours: { start: r.work_start, end: r.work_end, days: r.work_days ?? [] },
});

const rowToPatient = (r: PatientRow): Patient => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  phone: r.phone,
});

const rowToAppointment = (r: AppointmentRow, patients: Map<string, Patient>): Appointment => {
  const p = patients.get(r.patient_id);
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: p?.name ?? "(unknown patient)",
    patientPhone: p?.phone ?? "",
    reason: r.reason,
    therapistId: r.therapist_id,
    date: r.date,
    slotKey: r.slot_key,
    createdAt: r.created_at,
  };
};

export type ConnectionStatus = "connecting" | "connected" | "error";

type ClinicContextValue = {
  therapists: Therapist[];
  patients: Patient[];
  appointments: Appointment[];
  loading: boolean;
  connectionStatus: ConnectionStatus;
  reconnect: () => void;
  refresh: () => Promise<void>;
  addAppointment: (a: {
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    reason: string;
    therapistId: string;
    date: string;
    slotKey: string;
  }) => Promise<{ id: string } | null>;
  updateAppointment: (
    id: string,
    patch: Partial<Pick<Appointment, "therapistId" | "date" | "slotKey" | "reason">>,
  ) => Promise<void>;
  cancelAppointment: (id: string) => Promise<Appointment | undefined>;
  restoreAppointment: (a: Appointment) => Promise<void>;
  getTherapist: (id: string) => Therapist | undefined;
  getPatient: (id: string) => Patient | undefined;
  validateBooking: (a: {
    id?: string;
    therapistId: string;
    date: string;
    slotKey: string;
  }) => ValidationResult;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [reconnectTick, setReconnectTick] = useState(0);

  const patientsMapRef = useRef<Map<string, Patient>>(new Map());
  patientsMapRef.current = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  // Track appointment ids the current tab just mutated so we don't toast our own actions.
  const localEchoRef = useRef<Map<string, number>>(new Map());
  const markLocal = useCallback((id: string) => {
    localEchoRef.current.set(id, Date.now() + 4000);
  }, []);
  const isLocalEcho = useCallback((id: string) => {
    const t = localEchoRef.current.get(id);
    if (!t) return false;
    if (Date.now() > t) {
      localEchoRef.current.delete(id);
      return false;
    }
    return true;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes, aRes] = await Promise.all([
      supabase.from("therapists").select("*").order("sort_order", { ascending: true }),
      supabase.from("patients").select("*").order("name", { ascending: true }),
      supabase.from("appointments").select("*").order("date", { ascending: true }),
    ]);
    if (tRes.error) console.error("therapists", tRes.error);
    if (pRes.error) console.error("patients", pRes.error);
    if (aRes.error) console.error("appointments", aRes.error);

    const ther = (tRes.data ?? []).map((r) => rowToTherapist(r as TherapistRow));
    const pats = (pRes.data ?? []).map((r) => rowToPatient(r as PatientRow));
    const patsMap = new Map(pats.map((p) => [p.id, p]));
    const appts = (aRes.data ?? []).map((r) => rowToAppointment(r as AppointmentRow, patsMap));

    setTherapists(ther);
    setPatients(pats);
    setAppointments(appts);
    setLoading(false);
  }, []);

  // Load + realtime lifecycle; keyed on user + reconnect tick.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTherapists([]);
      setPatients([]);
      setAppointments([]);
      setLoading(false);
      setConnectionStatus("connecting");
      return;
    }

    let disposed = false;
    setConnectionStatus("connecting");
    void loadAll();

    const channel = supabase
      .channel(`clinic-realtime-${reconnectTick}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          const map = patientsMapRef.current;
          if (payload.eventType === "INSERT") {
            const row = payload.new as AppointmentRow;
            const appt = rowToAppointment(row, map);
            setAppointments((prev) =>
              prev.some((a) => a.id === appt.id) ? prev : [...prev, appt],
            );
            if (!isLocalEcho(appt.id)) {
              const slot = SLOTS.find((s) => s.key === appt.slotKey);
              toast.success("New appointment booked", {
                description: `${appt.patientName} · ${slot?.label ?? appt.slotKey}`,
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as AppointmentRow;
            const appt = rowToAppointment(row, map);
            setAppointments((prev) => prev.map((a) => (a.id === appt.id ? appt : a)));
            if (!isLocalEcho(appt.id)) {
              const slot = SLOTS.find((s) => s.key === appt.slotKey);
              toast("Appointment rescheduled", {
                description: `${appt.patientName} · ${slot?.label ?? appt.slotKey}`,
              });
            }
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string } | null;
            const id = oldRow?.id;
            if (!id) return;
            let removed: Appointment | undefined;
            setAppointments((prev) => {
              removed = prev.find((a) => a.id === id);
              return prev.filter((a) => a.id !== id);
            });
            if (removed && !isLocalEcho(id)) {
              toast("Appointment cancelled", {
                description: `${removed.patientName}`,
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = rowToPatient(payload.new as PatientRow);
            setPatients((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === "UPDATE") {
            const row = rowToPatient(payload.new as PatientRow);
            setPatients((prev) => prev.map((p) => (p.id === row.id ? row : p)));
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string })?.id;
            if (id) setPatients((prev) => prev.filter((p) => p.id !== id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "therapists" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = rowToTherapist(payload.new as TherapistRow);
            setTherapists((prev) =>
              prev.some((t) => t.id === row.id) ? prev : [...prev, row],
            );
          } else if (payload.eventType === "UPDATE") {
            const row = rowToTherapist(payload.new as TherapistRow);
            setTherapists((prev) => prev.map((t) => (t.id === row.id ? row : t)));
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string })?.id;
            if (id) setTherapists((prev) => prev.filter((t) => t.id !== id));
          }
        },
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") setConnectionStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("error");
          // Auto-retry after 4s
          setTimeout(() => {
            if (!disposed) setReconnectTick((n) => n + 1);
          }, 4000);
        } else if (status === "CLOSED") {
          setConnectionStatus("connecting");
        }
      });

    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, reconnectTick, loadAll, isLocalEcho]);

  const reconnect = useCallback(() => {
    setConnectionStatus("connecting");
    setReconnectTick((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const getTherapist = useCallback(
    (id: string) => therapists.find((t) => t.id === id),
    [therapists],
  );
  const getPatient = useCallback((id: string) => patients.find((p) => p.id === id), [patients]);

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
        return { ok: false, error: `Slot is outside ${therapist.name}'s working hours.` };
      }
      const conflict = appointments.find(
        (a) =>
          a.id !== id &&
          a.therapistId === therapistId &&
          a.date === date &&
          a.slotKey === slotKey,
      );
      if (conflict) return { ok: false, error: "Therapist is already booked for this slot." };
      return { ok: true };
    },
    [appointments, therapists],
  );

  const addAppointment: ClinicContextValue["addAppointment"] = useCallback(
    async (a) => {
      let patientId = a.patientId;

      if (!patientId) {
        if (!a.patientName?.trim()) {
          toast.error("Patient is required");
          return null;
        }
        // Try to find by phone match first, else create a new walk-in patient
        const existing = patients.find(
          (p) => p.phone.trim() && p.phone.trim() === (a.patientPhone ?? "").trim(),
        );
        if (existing) {
          patientId = existing.id;
        } else {
          const { data: newP, error: pErr } = await supabase
            .from("patients")
            .insert({ name: a.patientName.trim(), phone: (a.patientPhone ?? "").trim() })
            .select()
            .single();
          if (pErr || !newP) {
            toast.error("Could not create patient", { description: pErr?.message });
            return null;
          }
          patientId = newP.id;
          const newPatient = rowToPatient(newP as PatientRow);
          patientsMapRef.current.set(newPatient.id, newPatient);
          setPatients((prev) =>
            prev.some((p) => p.id === newPatient.id) ? prev : [...prev, newPatient],
          );
        }
      }

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          patient_id: patientId,
          therapist_id: a.therapistId,
          date: a.date,
          slot_key: a.slotKey,
          reason: a.reason,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error || !data) {
        toast.error("Could not create appointment", { description: error?.message });
        return null;
      }
      markLocal(data.id);
      const row = rowToAppointment(data as AppointmentRow, patientsMapRef.current);
      setAppointments((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
      return { id: row.id };
    },
    [patients, user?.id, markLocal],
  );

  const updateAppointment: ClinicContextValue["updateAppointment"] = useCallback(
    async (id, patch) => {
      const payload: {
        therapist_id?: string;
        date?: string;
        slot_key?: string;
        reason?: string;
      } = {};
      if (patch.therapistId !== undefined) payload.therapist_id = patch.therapistId;
      if (patch.date !== undefined) payload.date = patch.date;
      if (patch.slotKey !== undefined) payload.slot_key = patch.slotKey;
      if (patch.reason !== undefined) payload.reason = patch.reason;

      markLocal(id);
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
        const row = rowToAppointment(data as AppointmentRow, patientsMapRef.current);
        setAppointments((prev) => prev.map((a) => (a.id === row.id ? row : a)));
      }
    },
    [markLocal],
  );

  const cancelAppointment: ClinicContextValue["cancelAppointment"] = useCallback(
    async (id) => {
      const removed = appointments.find((a) => a.id === id);
      markLocal(id);
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) {
        toast.error("Could not cancel appointment", { description: error.message });
        return undefined;
      }
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      return removed;
    },
    [appointments, markLocal],
  );

  const restoreAppointment: ClinicContextValue["restoreAppointment"] = useCallback(
    async (a) => {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          patient_id: a.patientId,
          therapist_id: a.therapistId,
          date: a.date,
          slot_key: a.slotKey,
          reason: a.reason,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) {
        toast.error("Could not restore appointment", { description: error.message });
        return;
      }
      if (data) {
        markLocal(data.id);
        const row = rowToAppointment(data as AppointmentRow, patientsMapRef.current);
        setAppointments((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
      }
    },
    [user?.id, markLocal],
  );

  const value = useMemo<ClinicContextValue>(
    () => ({
      therapists,
      patients,
      appointments,
      loading,
      connectionStatus,
      reconnect,
      refresh,
      addAppointment,
      updateAppointment,
      cancelAppointment,
      restoreAppointment,
      getTherapist,
      getPatient,
      validateBooking,
    }),
    [
      therapists,
      patients,
      appointments,
      loading,
      connectionStatus,
      reconnect,
      refresh,
      addAppointment,
      updateAppointment,
      cancelAppointment,
      restoreAppointment,
      getTherapist,
      getPatient,
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
