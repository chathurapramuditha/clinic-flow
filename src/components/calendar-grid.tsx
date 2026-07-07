import { useMemo } from "react";
import { SLOTS, keyToMinutes } from "@/lib/schedule";
import { useClinic } from "@/store/clinic-store";
import { therapistColor } from "./therapist-badge";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Therapist } from "@/lib/types";
import { SLOT_MINUTES } from "@/lib/schedule";

export function CalendarGrid({
  date,
  filterTherapistId,
  onCreate,
  onOpen,
}: {
  date: string;
  filterTherapistId: string | "all";
  onCreate: (opts: { slotKey: string; therapistId?: string }) => void;
  onOpen: (appointmentId: string) => void;
}) {
  const { therapists, appointments } = useClinic();

  const visibleTherapists = useMemo(
    () =>
      filterTherapistId === "all"
        ? therapists
        : therapists.filter((t) => t.id === filterTherapistId),
    [therapists, filterTherapistId],
  );

  const apptByCell = useMemo(() => {
    const map = new Map<string, (typeof appointments)[number]>();
    for (const a of appointments) {
      if (a.date === date) map.set(`${a.therapistId}:${a.slotKey}`, a);
    }
    return map;
  }, [appointments, date]);

  const dow = new Date(date + "T00:00:00").getDay();

  const isWithinHours = (t: Therapist, slotStart: number) => {
    if (!t.workingHours.days.includes(dow)) return false;
    return slotStart >= t.workingHours.start && slotStart + SLOT_MINUTES <= t.workingHours.end;
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[720px]"
          style={{
            gridTemplateColumns: `100px repeat(${visibleTherapists.length}, minmax(180px, 1fr))`,
          }}
        >
          {/* header row */}
          <div className="sticky left-0 z-10 border-b border-r bg-muted/60 px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Time
          </div>
          {visibleTherapists.map((t) => {
            const c = therapistColor(t);
            return (
              <div key={t.id} className={cn("border-b border-r px-3 py-3 last:border-r-0", c.bg)}>
                <div className={cn("text-sm font-semibold", c.text)}>{t.name}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t.status === "permanent" ? "Permanent" : "Part-time"} · {t.specialty}
                </div>
              </div>
            );
          })}

          {/* body rows */}
          {SLOTS.map((slot) => (
            <TimeRow key={slot.key} slotKey={slot.key} label={slot.label}>
              {visibleTherapists.map((t) => {
                const cellKey = `${t.id}:${slot.key}`;
                const appt = apptByCell.get(cellKey);
                const available = isWithinHours(t, keyToMinutes(slot.key));
                const c = therapistColor(t);
                if (appt) {
                  return (
                    <button
                      key={cellKey}
                      onClick={() => onOpen(appt.id)}
                      className={cn(
                        "group h-full min-h-16 border-b border-r px-2 py-2 text-left transition-colors",
                        c.bg,
                        "hover:brightness-95",
                      )}
                    >
                      <div className={cn("text-xs font-semibold", c.text)}>{appt.patientName}</div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {appt.reason}
                      </div>
                    </button>
                  );
                }
                if (!available) {
                  return (
                    <div
                      key={cellKey}
                      className="h-full min-h-16 border-b border-r bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(148,163,184,0.12)_6px,rgba(148,163,184,0.12)_12px)]"
                      title="Outside working hours"
                    />
                  );
                }
                return (
                  <button
                    key={cellKey}
                    onClick={() => onCreate({ slotKey: slot.key, therapistId: t.id })}
                    className="group flex h-full min-h-16 items-center justify-center border-b border-r bg-white text-muted-foreground/40 transition-colors hover:bg-teal-50 hover:text-teal-700"
                  >
                    <Plus className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })}
            </TimeRow>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeRow({
  slotKey,
  label,
  children,
}: {
  slotKey: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        key={`time-${slotKey}`}
        className="sticky left-0 z-10 border-b border-r bg-muted/30 px-3 py-3 text-xs font-medium text-muted-foreground"
      >
        {label}
      </div>
      {children}
    </>
  );
}
