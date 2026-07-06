// Slot & scheduling utilities for the physiotherapy clinic.
// Operating hours: 08:30 - 21:30, strict 45-minute slots.

export const CLINIC_START_MIN = 8 * 60 + 30; // 510
export const CLINIC_END_MIN = 21 * 60 + 30; // 1290
export const SLOT_MINUTES = 45;

export type Slot = {
  /** Minutes from midnight, start of slot. */
  start: number;
  /** Minutes from midnight, end of slot. */
  end: number;
  /** "HH:MM" 24h key, stable id. */
  key: string;
  /** e.g. "8:30 AM" */
  label: string;
  /** e.g. "8:30 AM - 9:15 AM" */
  rangeLabel: string;
};

export function minutesToLabel(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${m.toString().padStart(2, "0")} ${period}`;
}

export function minutesToKey(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function keyToMinutes(key: string): number {
  const [h, m] = key.split(":").map(Number);
  return h * 60 + m;
}

export function generateSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let s = CLINIC_START_MIN; s + SLOT_MINUTES <= CLINIC_END_MIN; s += SLOT_MINUTES) {
    const end = s + SLOT_MINUTES;
    slots.push({
      start: s,
      end,
      key: minutesToKey(s),
      label: minutesToLabel(s),
      rangeLabel: `${minutesToLabel(s)} - ${minutesToLabel(end)}`,
    });
  }
  return slots;
}

export const SLOTS: Slot[] = generateSlots();

export function todayISO(): string {
  const d = new Date();
  return isoDate(d);
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDay(iso: string): { weekday: string; day: string } {
  const d = new Date(iso + "T00:00:00");
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.getDate().toString(),
  };
}

export function getWeekDates(anchorIso: string): string[] {
  const d = new Date(anchorIso + "T00:00:00");
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday);
    nd.setDate(monday.getDate() + i);
    return isoDate(nd);
  });
}
