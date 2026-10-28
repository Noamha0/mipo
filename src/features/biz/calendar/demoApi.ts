// ⚠️ פיתוח בלבד: יומן דמו בזיכרון, פעיל רק כש-DEV_BYPASS דולק (אין התחברות אמיתית,
// ולכן business_calendar היה מחזיר not_allowed). מחקה את הכללים של ה-RPCs
// כדי שאפשר יהיה לראות ולנסות את כל המצבים. לא נטען ב-build לפרודקשן.
import { supabase } from '../../../lib/supabase';
import type { Service } from '../../../lib/types';
import { addDays, todayKey, zonedIso } from '../../book/datetime';
import { ACTIVE, type CalBlock, type CalBooking, type CalendarApi } from './api';

interface Store { bookings: CalBooking[]; blocks: CalBlock[]; services: Service[]; listeners: Set<(n: boolean) => void> }
const stores = new Map<string, Promise<Store>>();

const PEOPLE: [string, string, Partial<CalBooking>][] = [
  ['שירה לוי', '972541112233', { attended: 9, visits: 6, score: 100 }],
  ['מורן אזולאי', '972527654321', { attended: 3, no_shows: 1, visits: 2, score: 75 }],
  ['נועה כהן', '972501234000', {}],
  ['רותם בן דוד', '972538889900', { attended: 12, late_cancels: 1, visits: 12, score: 96 }],
  ['הדר פרץ', '972545556677', { attended: 2, no_shows: 2, visits: 1, score: 50 }],
  ['יעל מזרחי', '972502223344', { attended: 5, visits: 5, score: 100 }],
];

async function seed(businessId: string): Promise<Store> {
  const { data } = await supabase.from('services').select('*').eq('business_id', businessId).eq('active', true).order('sort_order');
  const services = (data ?? []) as Service[];
  const svc = (i: number) => services[i % Math.max(services.length, 1)];
  const t = todayKey();
  const now = Date.now();
  const bookings: CalBooking[] = [];

  const add = (day: number, time: string, person: number, svcIdx: number, extra: Partial<CalBooking> = {}) => {
    const s = svc(svcIdx);
    const starts = zonedIso(addDays(t, day), time);
    const dur = s?.duration_min ?? 60;
    const [name, phone, rel] = PEOPLE[person];
    bookings.push({
      id: crypto.randomUUID(), customer_id: phone, starts_at: starts,
      ends_at: new Date(new Date(starts).getTime() + dur * 60_000).toISOString(),
      status: day < 0 ? 'completed' : 'confirmed', source: 'link',
      total_price: s?.price ?? null, approval_deadline: null, late_cancel: false,
      no_show_disputed_at: null, no_show_reaffirmed_at: null, created_at: new Date(now - 86_400_000).toISOString(),
      customer_name: name, customer_phone: phone, customer_notes: null, services: s?.name ?? 'שירות',
      visits: 0, attended: 0, no_shows: 0, late_cancels: 0, score: null, ...rel, ...extra,
    });
  };

  add(-1, '10:00', 0, 0);
  add(-1, '12:00', 4, 1, { status: 'no_show', no_show_disputed_at: new Date(now - 3_600_000).toISOString() });
  add(0, '09:00', 3, 0);
  add(0, '10:30', 1, 1, { source: 'manual', customer_notes: 'מעדיפה צבעים בהירים' });
  add(0, '14:00', 5, 2);
  add(0, '16:00', 2, 0, { status: 'cancelled_by_customer' });
  add(0, '17:00', 0, 1);
  add(1, '09:30', 2, 0, { status: 'pending', source: 'search', approval_deadline: new Date(now + 42 * 60_000).toISOString() });
  add(1, '11:00', 3, 1);
  add(1, '15:00', 4, 0, { status: 'pending', approval_deadline: new Date(now + 25 * 60_000).toISOString() });
  add(2, '10:00', 5, 2);
  add(2, '13:00', 1, 0, { source: 'manual' });
  add(3, '09:00', 0, 0);
  add(4, '12:00', 3, 2);
  add(5, '09:00', 2, 1);

  const blocks: CalBlock[] = [
    { id: crypto.randomUUID(), starts_at: zonedIso(t, '12:30'), ends_at: zonedIso(t, '13:30'), reason: 'הפסקת צהריים' },
  ];
  return { bookings, blocks, services, listeners: new Set() };
}

export function createDemoApi(businessId: string): CalendarApi {
  if (!stores.has(businessId)) stores.set(businessId, seed(businessId));
  const store = () => stores.get(businessId)!;
  const changed = async (isNew = false) => (await store()).listeners.forEach((l) => l(isNew));
  const edit = async (id: string, fn: (b: CalBooking) => void) => {
    const b = (await store()).bookings.find((x) => x.id === id);
    if (!b) throw new Error('not_allowed');
    fn(b);
    await changed();
  };
  const overlaps = (list: { starts_at: string; ends_at: string }[], from: string, to: string) =>
    list.some((x) => x.starts_at < to && x.ends_at > from);

  return {
    async load(from, to) {
      const s = await store();
      const inRange = <T extends { starts_at: string; ends_at: string }>(x: T) => x.starts_at < to && x.ends_at > from;
      const bookings = s.bookings.filter(inRange).map((b) =>
        b.status === 'pending' && b.approval_deadline! < new Date().toISOString() ? { ...b, status: 'expired' as const } : { ...b });
      return { bookings: bookings.sort((a, b) => a.starts_at.localeCompare(b.starts_at)), blocks: s.blocks.filter(inRange) };
    },
    decide: (id, approve) => edit(id, (b) => {
      if (b.status !== 'pending') throw new Error('not_pending');
      b.status = approve ? 'confirmed' : 'rejected';
    }),
    cancel: (id) => edit(id, (b) => {
      if (!['pending', 'confirmed'].includes(b.status) || new Date(b.starts_at) <= new Date()) throw new Error('not_cancellable');
      b.status = 'cancelled_by_business';
    }),
    markAttendance: (id, attended) => edit(id, (b) => {
      if (new Date(b.starts_at) > new Date()) throw new Error('not_markable');
      b.status = attended ? 'completed' : 'no_show';
      if (attended) { b.no_show_disputed_at = null; b.no_show_reaffirmed_at = null; }
    }),
    reaffirmNoShow: (id) => edit(id, (b) => { b.no_show_reaffirmed_at = new Date().toISOString(); }),
    async createManual({ phone, name, serviceIds, start }) {
      const s = await store();
      const chosen = s.services.filter((x) => serviceIds.includes(x.id));
      if (!chosen.length) throw new Error('invalid_services');
      const end = new Date(new Date(start).getTime() + chosen.reduce((n, x) => n + x.duration_min, 0) * 60_000).toISOString();
      if (overlaps(s.bookings.filter((b) => ACTIVE.includes(b.status)), start, end)) throw new Error('slot_unavailable');
      const digits = phone.replace(/\D/g, '').replace(/^0/, '972');
      s.bookings.push({
        id: crypto.randomUUID(), customer_id: digits, starts_at: start, ends_at: end, status: 'confirmed', source: 'manual',
        total_price: chosen.reduce((n, x) => n + (x.price ?? 0), 0), approval_deadline: null, late_cancel: false,
        no_show_disputed_at: null, no_show_reaffirmed_at: null, created_at: new Date().toISOString(),
        customer_name: name || null, customer_phone: digits, customer_notes: null,
        services: chosen.map((x) => x.name).join(' + '), visits: 0, attended: 0, no_shows: 0, late_cancels: 0, score: null,
      });
      await changed();
    },
    async addBlock(from, to, reason) {
      (await store()).blocks.push({ id: crypto.randomUUID(), starts_at: from, ends_at: to, reason: reason.trim() || null });
      await changed();
    },
    async removeBlock(id) {
      const s = await store();
      s.blocks = s.blocks.filter((b) => b.id !== id);
      await changed();
    },
    subscribe(onChange) {
      let off = () => {};
      void store().then((s) => { s.listeners.add(onChange); off = () => s.listeners.delete(onChange); });
      return () => off();
    },
  };
}
