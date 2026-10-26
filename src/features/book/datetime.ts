// עיצוב תאריך/שעה בזמן ישראל (Asia/Jerusalem), עברית. ישמש גם את היומן באבן דרך 3.
const TZ = 'Asia/Jerusalem';

const dayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const keyFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
const shortDayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', timeZone: TZ });

/** "יום שלישי, 28 באוקטובר" */
export const dayLabel = (iso: string) => dayFmt.format(new Date(iso));
/** "14:30" */
export const timeLabel = (iso: string) => timeFmt.format(new Date(iso));
/** "2026-10-28" — מפתח קיבוץ ליום */
export const dayKey = (iso: string) => keyFmt.format(new Date(iso));
/** "28.10" */
export const shortDate = (iso: string) => dateFmt.format(new Date(iso)).replace('/', '.');

/** "היום" / "מחר" / "יום ג'" */
export function relativeDay(iso: string): string {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString());
  if (k === today) return 'היום';
  if (k === tomorrow) return 'מחר';
  return shortDayFmt.format(new Date(iso));
}
