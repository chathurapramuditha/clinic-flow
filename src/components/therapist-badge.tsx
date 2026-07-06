import type { Therapist } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLOR: Record<string, { bg: string; ring: string; text: string; solid: string }> = {
  teal: {
    bg: "bg-teal-50",
    ring: "ring-teal-200",
    text: "text-teal-800",
    solid: "bg-teal-500",
  },
  sky: {
    bg: "bg-sky-50",
    ring: "ring-sky-200",
    text: "text-sky-800",
    solid: "bg-sky-500",
  },
  indigo: {
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
    text: "text-indigo-800",
    solid: "bg-indigo-500",
  },
  cyan: {
    bg: "bg-cyan-50",
    ring: "ring-cyan-200",
    text: "text-cyan-800",
    solid: "bg-cyan-500",
  },
};

export function therapistColor(t: Therapist) {
  return COLOR[t.color] ?? COLOR.teal;
}

export function TherapistAvatar({
  therapist,
  className,
}: {
  therapist: Therapist;
  className?: string;
}) {
  const c = therapistColor(therapist);
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full text-xs font-semibold shadow-sm",
        c.solid,
        "text-white",
        className,
      )}
    >
      {therapist.initials}
    </div>
  );
}

export function StatusPill({ status }: { status: "permanent" | "non-permanent" }) {
  if (status === "permanent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Permanent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Part-time
    </span>
  );
}
