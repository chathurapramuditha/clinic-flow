import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useClinic } from "@/store/clinic-store";
import { useAuth } from "@/context/auth-context";
import { SLOTS, todayISO, prettyDate } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { CalendarPlus, CalendarCheck, Users, Stethoscope, Clock } from "lucide-react";
import { StatusPill, TherapistAvatar } from "@/components/therapist-badge";
import { BookingModal, type BookingModalState } from "@/components/booking-modal";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PhysioSchedule" },
      { name: "description", content: "Today at the physiotherapy clinic." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { appointments, therapists, loading } = useClinic();
  const { isPatient, isAdmin, isTherapist } = useAuth();
  const today = todayISO();
  const [booking, setBooking] = useState<BookingModalState>({ open: false, mode: "create" });

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => a.date === today)
        .sort((a, b) => a.slotKey.localeCompare(b.slotKey)),
    [appointments, today],
  );
  const dow = new Date(today + "T00:00:00").getDay();
  const activeTherapists = therapists.filter((t) => t.workingHours.days.includes(dow));
  const totalSlots = activeTherapists.length * SLOTS.length;
  const utilization = totalSlots > 0 ? Math.round((todays.length / totalSlots) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            {prettyDate(today)}
          </p>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {isPatient && !isAdmin && !isTherapist
              ? "Your upcoming visits"
              : "Good day, team"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPatient && !isAdmin && !isTherapist
              ? "Here are the appointments on your record."
              : "Here's what's happening at the clinic today."}
          </p>
        </div>
        <Button
          onClick={() => setBooking({ open: true, mode: "create" })}
          className="shrink-0 bg-gradient-to-r from-teal-500 to-sky-500 text-white shadow-md hover:opacity-95"
        >
          <CalendarPlus className="mr-2 h-4 w-4" /> Book appointment
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          label="Today's appointments"
          value={loading ? "—" : todays.length.toString()}
          accent="teal"
        />
        <StatCard
          icon={<Stethoscope className="h-5 w-5" />}
          label="Active therapists"
          value={loading ? "—" : `${activeTherapists.length} / ${therapists.length}`}
          accent="sky"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="45-min slots / day"
          value={SLOTS.length.toString()}
          accent="cyan"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Utilization"
          value={loading ? "—" : `${utilization}%`}
          accent="indigo"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming today</h2>
            <Link
              to="/calendar"
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              Open full calendar →
            </Link>
          </div>

          <div className="mt-4 divide-y">
            {loading && (
              <div className="space-y-3 py-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {!loading && todays.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No appointments booked yet today.
              </div>
            )}
            {!loading &&
              todays.map((a) => {
                const t = therapists.find((x) => x.id === a.therapistId);
                const slot = SLOTS.find((s) => s.key === a.slotKey);
                if (!t || !slot) return null;
                return (
                  <div key={a.id} className="flex items-center gap-3 py-3">
                    <div className="w-24 shrink-0 text-xs font-semibold text-foreground">
                      {slot.label}
                    </div>
                    <TherapistAvatar therapist={t} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.patientName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.reason} · {t.name}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">On staff today</h2>
          <ul className="mt-4 space-y-3">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-9 w-full" />
                </li>
              ))}
            {!loading &&
              therapists.map((t) => {
                const active = t.workingHours.days.includes(dow);
                return (
                  <li key={t.id} className="flex items-center gap-3">
                    <TherapistAvatar therapist={t} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.name}</span>
                        <StatusPill status={t.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {active ? "Scheduled today" : "Off today"}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      </div>

      <BookingModal state={booking} onOpenChange={(o) => setBooking((s) => ({ ...s, open: o }))} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "teal" | "sky" | "cyan" | "indigo";
}) {
  const map = {
    teal: "from-teal-500/10 to-teal-500/0 text-teal-700",
    sky: "from-sky-500/10 to-sky-500/0 text-sky-700",
    cyan: "from-cyan-500/10 to-cyan-500/0 text-cyan-700",
    indigo: "from-indigo-500/10 to-indigo-500/0 text-indigo-700",
  } as const;
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${map[accent]}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg bg-white/70 ${map[accent].split(" ").pop()}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
