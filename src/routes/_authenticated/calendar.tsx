import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClinic } from "@/store/clinic-store";
import { addDays, prettyDate, todayISO } from "@/lib/schedule";
import { CalendarGrid } from "@/components/calendar-grid";
import { BookingModal, type BookingModalState } from "@/components/booking-modal";
import { AppointmentDrawer } from "@/components/appointment-drawer";
import { CancelDialog } from "@/components/cancel-dialog";
import { CalendarPlus, ChevronLeft, ChevronRight, WifiOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — PhysioSchedule" },
      {
        name: "description",
        content: "Daily 45-minute appointment grid across all therapists.",
      },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { therapists, appointments, loading, connectionStatus, reconnect } = useClinic();
  const [date, setDate] = useState<string>(todayISO());
  const [therapistFilter, setTherapistFilter] = useState<string>("all");
  const [booking, setBooking] = useState<BookingModalState>({ open: false, mode: "create" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const openBookingCreate = (opts: { slotKey?: string; therapistId?: string } = {}) =>
    setBooking({
      open: true,
      mode: "create",
      initial: {
        date,
        slotKey: opts.slotKey,
        therapistId:
          opts.therapistId ?? (therapistFilter !== "all" ? therapistFilter : undefined),
      },
    });

  const openEdit = (id: string) => {
    const a = appointments.find((x) => x.id === id);
    if (!a) return;
    setOpenId(null);
    setBooking({ open: true, mode: "edit", appointmentId: id, initial: a });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Calendar</p>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {prettyDate(date)}
          </h1>
        </div>
        <Button
          onClick={() => openBookingCreate()}
          className="shrink-0 bg-gradient-to-r from-teal-500 to-sky-500 text-white shadow-md hover:opacity-95"
        >
          <CalendarPlus className="mr-2 h-4 w-4" /> New appointment
        </Button>
      </div>

      {connectionStatus === "error" && (
        <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Live updates disconnected</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Attempting to reconnect. Your calendar may be slightly out of date.</span>
            <Button size="sm" variant="outline" onClick={reconnect}>
              Retry now
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {connectionStatus === "connecting" && !loading && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to live updates…
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-[160px]"
          />
          <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-1"
            onClick={() => setDate(todayISO())}
          >
            Today
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Therapist</span>
          <Select value={therapistFilter} onValueChange={setTherapistFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All therapists</SelectItem>
              {therapists.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <Skeleton className="h-8 w-full" />
            <div className="mt-2 space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <CalendarGrid
            date={date}
            filterTherapistId={therapistFilter as "all" | string}
            onCreate={openBookingCreate}
            onOpen={setOpenId}
          />
        )}
      </div>

      <BookingModal
        state={booking}
        onOpenChange={(o) => setBooking((s) => ({ ...s, open: o }))}
      />
      <AppointmentDrawer
        appointmentId={openId}
        onClose={() => setOpenId(null)}
        onEdit={openEdit}
        onCancel={(id) => {
          setOpenId(null);
          setCancelId(id);
        }}
      />
      <CancelDialog appointmentId={cancelId} onClose={() => setCancelId(null)} />
    </div>
  );
}
