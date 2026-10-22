// A moment as the person reads it in French: « 22 oct. » with the year when it is not the current one, « 17:41 », and
// whether it falls today, for the labels that leave the day out then.
export function dayTime(iso: string, now: number): { day: string; time: string; isToday: boolean } {
  const at = new Date(iso);
  const today = new Date(now);
  const isThisYear = at.getFullYear() === today.getFullYear();
  return {
    day: at.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(isThisYear ? {} : { year: "numeric" }) }),
    time: at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    isToday: at.toDateString() === today.toDateString(),
  };
}
