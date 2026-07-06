import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClinic } from "@/store/clinic-store";
import { toast } from "sonner";
import { SLOTS } from "@/lib/schedule";

export function CancelDialog({
  appointmentId,
  onClose,
}: {
  appointmentId: string | null;
  onClose: () => void;
}) {
  const { appointments, cancelAppointment, restoreAppointment } = useClinic();
  const appt = appointments.find((a) => a.id === appointmentId);
  const slot = appt ? SLOTS.find((s) => s.key === appt.slotKey) : null;

  const handleConfirm = () => {
    if (!appointmentId) return;
    const removed = cancelAppointment(appointmentId);
    onClose();
    if (removed) {
      toast("Appointment cancelled", {
        description: `${removed.patientName} · ${slot?.rangeLabel ?? ""}`,
        action: {
          label: "Undo",
          onClick: () => restoreAppointment(removed),
        },
      });
    }
  };

  return (
    <AlertDialog open={!!appointmentId} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            {appt ? (
              <>
                This will remove{" "}
                <span className="font-medium text-foreground">{appt.patientName}</span>'s
                appointment{slot ? ` at ${slot.rangeLabel}` : ""}. You'll have a moment to undo.
              </>
            ) : (
              "This action cannot be undone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep appointment</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancel appointment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
