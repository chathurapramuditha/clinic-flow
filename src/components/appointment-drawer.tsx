import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/store/clinic-store";
import { SLOTS, prettyDate } from "@/lib/schedule";
import { CalendarClock, Phone, User, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { StatusPill, TherapistAvatar } from "./therapist-badge";

export function AppointmentDrawer({
  appointmentId,
  onClose,
  onEdit,
  onCancel,
}: {
  appointmentId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const { appointments, getTherapist } = useClinic();
  const appt = appointments.find((a) => a.id === appointmentId);
  const therapist = appt ? getTherapist(appt.therapistId) : undefined;
  const slot = appt ? SLOTS.find((s) => s.key === appt.slotKey) : undefined;

  return (
    <Sheet open={!!appointmentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {appt && therapist && slot ? (
          <>
            <SheetHeader>
              <SheetTitle>Appointment details</SheetTitle>
              <SheetDescription>
                {prettyDate(appt.date)} · {slot.rangeLabel}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6 px-4">
              <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3">
                <TherapistAvatar therapist={therapist} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{therapist.name}</p>
                    <StatusPill status={therapist.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{therapist.specialty}</p>
                </div>
              </div>

              <dl className="space-y-4 text-sm">
                <Field icon={<User className="h-4 w-4" />} label="Patient">
                  {appt.patientName}
                </Field>
                <Field icon={<Phone className="h-4 w-4" />} label="Phone">
                  <a href={`tel:${appt.patientPhone}`} className="text-sky-700 hover:underline">
                    {appt.patientPhone}
                  </a>
                </Field>
                <Field icon={<CalendarClock className="h-4 w-4" />} label="When">
                  {slot.rangeLabel}
                </Field>
                <Field icon={<ClipboardList className="h-4 w-4" />} label="Reason">
                  {appt.reason}
                </Field>
              </dl>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => onEdit(appt.id)}>
                  <Pencil className="mr-2 h-4 w-4" /> Reschedule
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => onCancel(appt.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </div>

              <Link
                to="/patients"
                onClick={onClose}
                className="block rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                Open patient record for{" "}
                <span className="font-semibold text-foreground">{appt.patientName}</span> →
              </Link>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}
