import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useClinic } from "@/store/clinic-store";
import { Input } from "@/components/ui/input";
import { SLOTS, prettyDate } from "@/lib/schedule";
import { Search, Phone } from "lucide-react";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — PhysioSchedule" },
      { name: "description", content: "Patient directory derived from appointments." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const { appointments, getTherapist } = useClinic();
  const [q, setQ] = useState("");

  const patients = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        phone: string;
        visits: typeof appointments;
      }
    >();
    for (const a of appointments) {
      const key = `${a.patientName.toLowerCase()}|${a.patientPhone}`;
      const existing = map.get(key);
      if (existing) existing.visits.push(a);
      else map.set(key, { name: a.patientName, phone: a.patientPhone, visits: [a] });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.phone.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Records</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Patients</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {patients.length} unique patient{patients.length === 1 ? "" : "s"} on file.
      </p>

      <div className="mt-6 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone"
          className="pl-9"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <ul className="divide-y">
          {filtered.length === 0 && (
            <li className="p-10 text-center text-sm text-muted-foreground">
              No patients match your search.
            </li>
          )}
          {filtered.map((p) => {
            const upcoming = [...p.visits].sort((a, b) =>
              (a.date + a.slotKey).localeCompare(b.date + b.slotKey),
            );
            const next = upcoming[0];
            const t = next ? getTherapist(next.therapistId) : undefined;
            const slot = next ? SLOTS.find((s) => s.key === next.slotKey) : undefined;
            return (
              <li key={p.name + p.phone} className="p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {p.phone}
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
      </div>
    </div>
  );
}
