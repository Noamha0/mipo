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

// ---------- שעון קיר בירושלים (היומן) ----------
// מפתח יום הוא "YYYY-MM-DD" ושעה היא "HH:MM", תמיד בזמן ישראל, בלי קשר לאזור הזמן של הדפדפן.

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function tzOffsetMs(utcMs: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(utcMs / 60_000) * 60_000;
}

/** ("2026-10-28", "14:30") → ISO של אותו רגע בירושלים */
export function zonedIso(key: string, hhmm: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess - tzOffsetMs(guess);
  utc = guess - tzOffsetMs(utc); // תיקון סביב מעבר שעון קיץ
  return new Date(utc).toISOString();
}

/** דקות מחצות בירושלים */
export function minutesOfDay(iso: string): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return +p.hour * 60 + +p.minute;
}

export const todayKey = () => dayKey(new Date().toISOString());

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = ראשון */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const weekStart = (key: string) => addDays(key, -weekdayOf(key));

/** 870 → "14:30" */
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** "09:00:00" → 540 */
export const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** יום תצוגה ממפתח יום (בצהריים, כדי שלא יזלוג ליום סמוך) */
export const keyToIso = (key: string) => zonedIso(key, '12:00');
