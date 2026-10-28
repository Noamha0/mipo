// ⚠️ פיתוח בלבד: "התורים שלי" ומועדפים בזיכרון, פעיל רק כש-DEV_BYPASS דולק
// (אין משתמש אמיתי, אז my_bookings היה מחזיר רשימה ריקה). לא נטען ב-build לפרודקשן.
import { supabase } from '../../lib/supabase';
import type { Business } from '../../lib/types';
import { addDays, todayKey, zonedIso } from '../book/datetime';
import type { MeApi, MyBooking, Profile } from './api';

let store: Promise<{ bookings: MyBooking[]; businesses: Business[]; favs: Set<string>; profile: Profile }> | null = null;

async function seed() {
  const { data } = await supabase.from('businesses').select('*').like('slug', 'mipo-demo-%').limit(6);
  const biz = (data ?? []) as Business[];
  const t = todayKey();
  const now = Date.now();
  const make = (i: number, day: number, time: string, dur: number, extra: Partial<MyBooking>): MyBooking => {
    const b = biz[i % Math.max(biz.length, 1)];
    const starts = zonedIso(addDays(t, day), time);
    const confirmedish = ['confirmed', 'completed'].includes(extra.status ?? 'confirmed');
    return {
      id: crypto.randomUUID(), business_id: b?.id ?? '', business_name: b?.name ?? 'עסק', business_slug: b?.slug ?? '',
      business_phone: '0501234567', business_image: b?.image_url ?? null, address_mode: b?.address_mode ?? 'studio',
      city: b?.city ?? 'עפולה', neighborhood: b?.neighborhood ?? null,
      street: b?.address_mode === 'home' && !confirmedish ? null : 'הנרקיסים', house_number: b?.address_mode === 'home' && !confirmedish ? null : '12',
      entrance_notes: null, starts_at: starts, ends_at: new Date(new Date(starts).getTime() + dur * 60_000).toISOString(),
      status: 'confirmed', total_price: 120, approval_deadline: null, late_cancel: false, no_show_disputed_at: null,
      services: 'שירות', can_cancel: false, cancel_is_late: false, can_dispute: false, ...extra,
    };
  };
  const bookings = [
    make(0, 0, '18:00', 60, { services: "לק ג'ל", can_cancel: true, cancel_is_late: true }),
    make(1, 2, '10:30', 30, { services: 'תספורת גברים', total_price: 70, can_cancel: true }),
    make(3, 1, '12:00', 60, { status: 'pending', services: 'עיסוי שוודי', total_price: 200, approval_deadline: new Date(now + 40 * 60_000).toISOString(), can_cancel: true }),
    make(4, -3, '09:00', 180, { status: 'completed', services: 'ניקיון בית', total_price: 360 }),
    make(2, -7, '19:00', 60, { status: 'no_show', services: 'יוגה', total_price: 80, can_dispute: true }),
    make(5, -10, '16:00', 45, { status: 'cancelled_by_customer', services: 'דוגווקר', total_price: 70, late_cancel: true }),
  ];
  return {
    bookings, businesses: biz, favs: new Set(biz.slice(0, 2).map((b) => b.id)),
    profile: { name: 'נועה', phone: '972501234567', alt_preference: 'both' as const, attended: 6, no_shows: 1, late_cancels: 1, score: 80 },
  };
}

const s = () => (store ??= seed());
const find = async (id: string) => {
  const b = (await s()).bookings.find((x) => x.id === id);
  if (!b) throw new Error('not_allowed');
  return b;
};

export const demoMeApi: MeApi = {
  bookings: async () => [...(await s()).bookings].sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
  async cancel(id) {
    const b = await find(id);
    if (!b.can_cancel) throw new Error('not_cancellable');
    Object.assign(b, { status: 'cancelled_by_customer', late_cancel: b.cancel_is_late, can_cancel: false });
  },
  async dispute(id) {
    const b = await find(id);
    if (!b.can_dispute) throw new Error('not_disputable');
    Object.assign(b, { no_show_disputed_at: new Date().toISOString(), can_dispute: false });
  },
  favorites: async () => {
    const st = await s();
    return st.businesses.filter((b) => st.favs.has(b.id));
  },
  favoriteIds: async () => [...(await s()).favs],
  async toggleFavorite(id) {
    const { favs } = await s();
    if (favs.delete(id)) return false;
    favs.add(id);
    return true;
  },
  profile: async () => ({ ...(await s()).profile }),
  async saveProfile({ name, alt_preference }) {
    Object.assign((await s()).profile, { name: name.trim() || null, alt_preference });
  },
};
