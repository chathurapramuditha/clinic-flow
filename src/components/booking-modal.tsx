import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClinic } from "@/store/clinic-store";
import { useAuth } from "@/context/auth-context";
import { SLOTS, todayISO } from "@/lib/schedule";
import type { Appointment } from "@/lib/types";
import { StatusPill } from "./therapist-badge";
import { SLOT_MINUTES } from "@/lib/schedule";
import { toast } from "sonner";

type Mode = "create" | "edit";

export type BookingModalState = {
  open: boolean;
  mode: Mode;
  initial?: Partial<Appointment>;
  appointmentId?: string;
};

const NEW_PATIENT = "__new__";

export function BookingModal({
  state,
  onOpenChange,
}: {
  state: BookingModalState;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    therapists,
    patients,
    addAppointment,
    updateAppointment,
    validateBooking,
  } = useClinic();
  const { isPatient, isAdmin, isTherapist, user } = useAuth();

  const myPatient = useMemo(
    () => patients.find((p) => p.userId === user?.id),
    [patients, user?.id],
  );
  const canPickPatient = isAdmin || isTherapist;

  const [patientMode, setPatientMode] = useState<string>("existing"); // patient id or NEW_PATIENT
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [reason, setReason] = useState("");
  const [therapistId, setTherapistId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [slotKey, setSlotKey] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setReason(state.initial?.reason ?? "");
    setTherapistId(state.initial?.therapistId ?? "");
    setDate(state.initial?.date ?? todayISO());
    setSlotKey(state.initial?.slotKey ?? "");
    setErrors({});
    if (state.mode === "edit" && state.initial?.patientId) {
      setPatientMode(state.initial.patientId);
      setPatientName(state.initial.patientName ?? "");
      setPatientPhone(state.initial.patientPhone ?? "");
    } else if (!canPickPatient && myPatient) {
      setPatientMode(myPatient.id);
      setPatientName(myPatient.name);
      setPatientPhone(myPatient.phone);
    } else {
      setPatientMode(patients[0]?.id ?? NEW_PATIENT);
      setPatientName("");
      setPatientPhone("");
    }
  }, [state.open, state.initial, state.mode, canPickPatient, myPatient, patients]);

  const dow = useMemo(() => new Date(date + "T00:00:00").getDay(), [date]);

  const availableSlots = useMemo(() => {
    const t = therapists.find((x) => x.id === therapistId);
    if (!t) return SLOTS;
    if (!t.workingHours.days.includes(dow)) return [];
    return SLOTS.filter(
      (s) =>
        s.start >= t.workingHours.start && s.start + SLOT_MINUTES <= t.workingHours.end,
    );
  }, [therapists, therapistId, dow]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (canPickPatient) {
      if (!patientMode) e.patient = "Select a patient.";
      if (patientMode === NEW_PATIENT) {
        if (!patientName.trim()) e.patientName = "Patient name is required.";
        else if (patientName.trim().length < 2)
          e.patientName = "Name must be at least 2 characters.";
        if (!patientPhone.trim()) e.patientPhone = "Phone number is required.";
        else if (!/^[+\d][\d\s\-()]{5,}$/.test(patientPhone.trim()))
          e.patientPhone = "Enter a valid phone number.";
      }
    } else if (!myPatient) {
      e.patient = "Your patient profile is not ready yet.";
    }
    if (!reason.trim()) e.reason = "Please provide a reason for the visit.";
    if (!therapistId) e.therapistId = "Select a therapist.";
    if (!date) e.date = "Select a date.";
    if (!slotKey) e.slotKey = "Select a time slot.";

    if (!e.therapistId && !e.date && !e.slotKey) {
      const v = validateBooking({
        id: state.appointmentId,
        therapistId,
        date,
        slotKey,
      });
      if (!v.ok) e.slotKey = v.error;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (state.mode === "edit" && state.appointmentId) {
        await updateAppointment(state.appointmentId, {
          therapistId,
          date,
          slotKey,
          reason: reason.trim(),
        });
        toast.success("Appointment updated");
      } else {
        let patientId: string | undefined;
        if (canPickPatient) {
          if (patientMode !== NEW_PATIENT) patientId = patientMode;
        } else {
          patientId = myPatient?.id;
        }
        const res = await addAppointment({
          patientId,
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          reason: reason.trim(),
          therapistId,
          date,
          slotKey,
        });
        if (!res) return;
        toast.success("Appointment booked");
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const selectedTherapist = therapists.find((t) => t.id === therapistId);

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit appointment" : "Book new appointment"}
          </DialogTitle>
          <DialogDescription>
            Appointments are 45 minutes. All times are shown in local clinic time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {canPickPatient ? (
            <div className="grid gap-1.5">
              <Label>Patient</Label>
              <Select
                value={patientMode}
                onValueChange={(v) => {
                  setPatientMode(v);
                  if (v !== NEW_PATIENT) {
                    const p = patients.find((x) => x.id === v);
                    setPatientName(p?.name ?? "");
                    setPatientPhone(p?.phone ?? "");
                  } else {
                    setPatientName("");
                    setPatientPhone("");
                  }
                }}
                disabled={state.mode === "edit"}
              >
                <SelectTrigger aria-invalid={!!errors.patient}>
                  <SelectValue placeholder="Select or add a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_PATIENT}>+ Add new patient</SelectItem>
                </SelectContent>
              </Select>
              {errors.patient && <p className="text-xs text-destructive">{errors.patient}</p>}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Booking as
              </p>
              <p className="mt-0.5 font-medium">{myPatient?.name ?? "You"}</p>
              {myPatient?.phone && (
                <p className="text-xs text-muted-foreground">{myPatient.phone}</p>
              )}
              {errors.patient && <p className="mt-1 text-xs text-destructive">{errors.patient}</p>}
            </div>
          )}

          {canPickPatient && patientMode === NEW_PATIENT && (
            <div className="grid gap-3 rounded-lg border border-dashed p-3">
              <div className="grid gap-1.5">
                <Label htmlFor="patientName">Patient name</Label>
                <Input
                  id="patientName"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Jane Doe"
                  aria-invalid={!!errors.patientName}
                />
                {errors.patientName && (
                  <p className="text-xs text-destructive">{errors.patientName}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="patientPhone">Phone number</Label>
                <Input
                  id="patientPhone"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+1 555-0100"
                  aria-invalid={!!errors.patientPhone}
                />
                {errors.patientPhone && (
                  <p className="text-xs text-destructive">{errors.patientPhone}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="reason">Reason for visit</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Post-op knee rehabilitation, session 3"
              aria-invalid={!!errors.reason}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>Therapist</Label>
            <Select value={therapistId} onValueChange={setTherapistId}>
              <SelectTrigger aria-invalid={!!errors.therapistId}>
                <SelectValue placeholder="Assign a physiotherapist" />
              </SelectTrigger>
              <SelectContent>
                {therapists.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <span>{t.name}</span>
                      <StatusPill status={t.status} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.therapistId && (
              <p className="text-xs text-destructive">{errors.therapistId}</p>
            )}
            {selectedTherapist && (
              <p className="text-xs text-muted-foreground">
                Works {formatWorkingHours(selectedTherapist.workingHours)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.date}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Time slot</Label>
              <Select
                value={slotKey}
                onValueChange={setSlotKey}
                disabled={!therapistId || availableSlots.length === 0}
              >
                <SelectTrigger aria-invalid={!!errors.slotKey}>
                  <SelectValue
                    placeholder={
                      !therapistId
                        ? "Select therapist first"
                        : availableSlots.length === 0
                          ? "Not working this day"
                          : "Pick a 45-min slot"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {availableSlots.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.rangeLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.slotKey && <p className="text-xs text-destructive">{errors.slotKey}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy}
            className="bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:opacity-95"
          >
            {busy ? "Saving…" : state.mode === "edit" ? "Save changes" : "Book appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatWorkingHours(wh: { start: number; end: number; days: number[] }) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = wh.days.map((d) => dayNames[d]).join(", ");
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
  };
  return `${days} · ${fmt(wh.start)} – ${fmt(wh.end)}`;
}
