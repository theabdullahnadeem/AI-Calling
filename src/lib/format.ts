/** Shared display formatting for the dashboard (server and client safe). */

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Sentiment → dot class per the design doc's restrained mapping. */
export function sentimentDotClass(
  sentiment: string | null | undefined,
): string {
  if (sentiment === "positive") return "dv-dot dv-dot--signal";
  if (sentiment === "negative") return "dv-dot dv-dot--alert";
  return "dv-dot";
}

export function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
