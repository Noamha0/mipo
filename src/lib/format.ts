/** 050-1234567 / 0501234567 → +972501234567 (הפורמט ש-Supabase Auth מצפה לו) */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+972' + digits;
}

/** 972501234567 / +972501234567 → 050-1234567 */
export function displayPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('972') ? '0' + digits.slice(3) : digits;
  return local.length === 10 ? `${local.slice(0, 3)}-${local.slice(3)}` : local;
}

/** 30 → "30 דק'", 60 → "שעה", 90 → "שעה וחצי", 135 → "2 ש' ו-15 דק'" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} דק'`;
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  if (m === 0) return hours;
  if (h <= 2 && m === 30) return `${hours} וחצי`;
  if (h <= 2 && m === 15) return `${hours} ורבע`;
  return `${h} ש' ו-${m} דק'`;
}

export function formatPrice(price: number | null): string {
  return price == null ? 'מחיר בהתאמה' : `₪${Number(price).toLocaleString('he-IL')}`;
}

// תעתיק גס עברית→לטינית להצעת כתובת לינק. העסק תמיד יכול לתקן.
const translit: Record<string, string> = {
  א: 'a', ב: 'b', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'ch', ט: 't', י: 'y',
  כ: 'k', ך: 'k', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', ע: 'a', פ: 'p',
  ף: 'f', צ: 'tz', ץ: 'tz', ק: 'k', ר: 'r', ש: 'sh', ת: 't',
};

export function suggestSlug(name: string): string {
  return cleanSlug(
    [...name.toLowerCase()].map((ch) => translit[ch] ?? ch).join(''),
  );
}

export function cleanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40);
}

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
