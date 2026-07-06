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
import { SLOTS, todayISO, keyToMinutes } from "@/lib/schedule";
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

export function BookingModal({
  state,
  onOpenChange,
}: {
  state: BookingModalState;
  onOpenChange: (open: boolean) => void;
}) {
  const { therapists, addAppointment, updateAppointment, validateBooking } = useClinic();

  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [reason, setReason] = useState("");
  const [therapistId, setTherapistId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [slotKey, setSlotKey] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.open) {
      setPatientName(state.initial?.patientName ?? "");
      setPatientPhone(state.initial?.patientPhone ?? "");
      setReason(state.initial?.reason ?? "");
      setTherapistId(state.initial?.therapistId ?? "");
      setDate(state.initial?.date ?? todayISO());
      setSlotKey(state.initial?.slotKey ?? "");
      setErrors({});
    }
  }, [state.open, state.initial]);

  const dow = useMemo(() => new Date(date + "T00:00:00").getDay(), [date]);

  const availableSlots = useMemo(() => {
    const t = therapists.find((x) => x.id === therapistId);
    if (!t) return SLOTS;
    if (!t.workingHours.days.includes(dow)) return [];
    return SLOTS.filter(
      (s) =>
        s.start >= t.workingHours.start &&
        s.start + SLOT_MINUTES <= t.workingHours.end,
    );
  }, [therapists, therapistId, dow]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!patientName.trim()) e.patientName = "Patient name is required.";
    else if (patientName.trim().length < 2) e.patientName = "Name must be at least 2 characters.";
    if (!patientPhone.trim()) e.patientPhone = "Phone number is required.";
    else if (!/^[+\d][\d\s\-()]{5,}$/.test(patientPhone.trim()))
      e.patientPhone = "Enter a valid phone number.";
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

  const handleSubmit = () => {
    if (!validate()) return;
    const payload = {
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      reason: reason.trim(),
      therapistId,
      date,
      slotKey,
    };
    if (state.mode === "edit" && state.appointmentId) {
      updateAppointment(state.appointmentId, payload);
      toast.success("Appointment updated");
    } else {
      addAppointment(payload);
      toast.success("Appointment booked");
    }
    onOpenChange(false);
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:opacity-95"
          >
            {state.mode === "edit" ? "Save changes" : "Book appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatWorkingHours(wh: {
  start: number;
  end: number;
  days: number[];
}) {
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

// silence unused import warning if tree-shaken
void keyToMinutes;
