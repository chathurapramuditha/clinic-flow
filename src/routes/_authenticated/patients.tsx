import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useClinic } from "@/store/clinic-store";
import { Input } from "@/components/ui/input";
import { SLOTS, prettyDate } from "@/lib/schedule";
import { Search, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Patients — PhysioSchedule" },
      { name: "description", content: "Patient directory." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const { patients, appointments, getTherapist, loading } = useClinic();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return patients
      .map((p) => {
        const visits = appointments
          .filter((a) => a.patientId === p.id)
          .sort((a, b) => (a.date + a.slotKey).localeCompare(b.date + b.slotKey));
        return { ...p, visits };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [patients, appointments]);

  const filtered = rows.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.phone.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Records</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Patients</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {loading ? "Loading…" : `${rows.length} patient${rows.length === 1 ? "" : "s"} on file.`}
      </p>

      <div className="mt-6 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {!loading && (
          <ul className="divide-y">
            {filtered.length === 0 && (
              <li className="p-10 text-center text-sm text-muted-foreground">
                No patients on file.
              </li>
            )}
            {filtered.map((p) => {
              const next = p.visits[0];
              const t = next ? getTherapist(next.therapistId) : undefined;
              const slot = next ? SLOTS.find((s) => s.key === next.slotKey) : undefined;
              return (
                <li key={p.id} className="p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {p.phone || "—"}
                      </div>
                      {next && slot && t && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Next: {prettyDate(next.date)} · {slot.label} · {t.name}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
                      {p.visits.length} visit{p.visits.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
