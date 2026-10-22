export interface AgeUnits {
  s: string;
  min: string;
  h: string;
  d: string;
}

// « 42 s », « 12 min », « 2 h 05 », « 3 j »: the units come from the translation layer.
export function formatAge(ms: number, units: AgeUnits): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} ${units.s}`;
  if (s < 3600) return `${Math.floor(s / 60)} ${units.min}`;
  if (s < 86_400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m ? `${h} ${units.h} ${String(m).padStart(2, "0")}` : `${h} ${units.h}`;
  }
  return `${Math.floor(s / 86_400)} ${units.d}`;
}
