import { createFileRoute } from "@tanstack/react-router";
import { useClinic } from "@/store/clinic-store";
import { StatusPill, TherapistAvatar, therapistColor } from "@/components/therapist-badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/therapists")({
  head: () => ({
    meta: [
      { title: "Therapists — PhysioSchedule" },
      { name: "description", content: "Physiotherapy team directory and working hours." },
    ],
  }),
  component: TherapistsPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

function TherapistsPage() {
  const { therapists, loading } = useClinic();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Team</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Physiotherapy staff</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Two permanent and two part-time therapists cover the clinic's 8:30 AM – 9:30 PM window.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        {!loading &&
          therapists.map((t) => {
            const c = therapistColor(t);
            return (
              <article
                key={t.id}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm"
              >
                <div className={cn("border-b p-5", c.bg)}>
                  <div className="flex items-start gap-3">
                    <TherapistAvatar therapist={t} className="h-12 w-12 text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={cn("truncate text-base font-semibold", c.text)}>
                          {t.name}
                        </h2>
                        <StatusPill status={t.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{t.specialty}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Working hours
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {fmt(t.workingHours.start)} – {fmt(t.workingHours.end)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {DAYS.map((d, i) => {
                      const on = t.workingHours.days.includes(i);
                      return (
                        <span
                          key={d}
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-medium",
                            on
                              ? cn(c.bg, c.text, "ring-1", c.ring)
                              : "bg-muted text-muted-foreground/60",
                          )}
                        >
                          {d}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
