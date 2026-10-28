import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { DEV_BYPASS } from '../../auth/useSession';
import { createDemoApi } from './demoApi';

export type BookingStatus =
  | 'pending' | 'confirmed' | 'rejected' | 'expired'
  | 'cancelled_by_customer' | 'cancelled_by_business' | 'completed' | 'no_show';

/** שורה מ-business_calendar (0003) */
export interface CalBooking {
  id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: 'link' | 'search' | 'manual';
  total_price: number | null;
  approval_deadline: string | null;
  late_cancel: boolean;
  no_show_disputed_at: string | null;
  no_show_reaffirmed_at: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string;
  customer_notes: string | null;
  services: string | null;
  visits: number;
  attended: number;
  no_shows: number;
  late_cancels: number;
  score: number | null;
}

export interface CalBlock {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface ManualBookingInput {
  phone: string;
  name: string;
  serviceIds: string[];
  start: string;
}

/** כל מה שהיומן צריך מהשרת. כל שינוי בתור עובר דרך ה-RPCs של 0001. */
export interface CalendarApi {
  load(from: string, to: string): Promise<{ bookings: CalBooking[]; blocks: CalBlock[] }>;
  decide(id: string, approve: boolean): Promise<void>;
  cancel(id: string): Promise<void>;
  markAttendance(id: string, attended: boolean): Promise<void>;
  reaffirmNoShow(id: string): Promise<void>;
  createManual(input: ManualBookingInput): Promise<void>;
  addBlock(from: string, to: string, reason: string): Promise<void>;
  removeBlock(id: string): Promise<void>;
  /** מחזיר פונקציית ביטול. isNew = נכנסה הזמנה חדשה (לא שינוי שלנו). */
  subscribe(onChange: (isNew: boolean) => void): () => void;
}

/** פעיל = תופס מקום ביומן */
export const ACTIVE: BookingStatus[] = ['pending', 'confirmed', 'completed', 'no_show'];

const ERRORS: Record<string, string> = {
  slot_unavailable: 'השעה הזו כבר תפוסה ביומן.',
  not_pending: 'הבקשה כבר טופלה.',
  approval_expired: 'עבר הזמן לאישור הבקשה, והמשבצת שוחררה.',
  not_cancellable: 'אי אפשר לבטל תור שכבר התחיל או הסתיים.',
  not_markable: 'אפשר לסמן הגעה רק אחרי תחילת התור.',
  not_disputed: 'אין ערעור פתוח על התור הזה.',
  invalid_services: 'צריך לבחור לפחות שירות פעיל אחד.',
  customers_phone_check: 'מספר הטלפון לא תקין.',
  not_allowed: 'אין הרשאה לפעולה הזו.',
};

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : 'משהו השתבש. נסי שוב.';
}

// "[\"2026-10-28 08:00:00+00\",\"2026-10-28 10:00:00+00\")" → [ISO, ISO]
function parseRange(r: string): [string, string] {
  const [a, b] = r.slice(1, -1).split(',').map((x) => x.replace(/"/g, '').trim().replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
  return [new Date(a).toISOString(), new Date(b).toISOString()];
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
}

function createSupabaseApi(businessId: string): CalendarApi {
  let calendarId: string | null = null;
  let channel: RealtimeChannel | null = null;
  const listeners = new Set<(isNew: boolean) => void>();
  const ownWrites = { at: 0 };
  const mutate = async (fn: string, args: Record<string, unknown>) => {
    ownWrites.at = Date.now();
    await rpc(fn, args);
  };

  return {
    async load(from, to) {
      const [b, x] = await Promise.all([
        supabase.rpc('business_calendar', { p_business_id: businessId, p_from: from, p_to: to }),
        supabase.from('calendar_exceptions').select('id, during, reason')
          .eq('business_id', businessId).eq('kind', 'block').overlaps('during', `[${from},${to})`),
      ]);
      if (b.error) throw new Error(b.error.message);
      if (x.error) throw new Error(x.error.message);
      return {
        bookings: (b.data ?? []) as CalBooking[],
        blocks: (x.data ?? []).map((r) => {
          const [starts_at, ends_at] = parseRange(r.during as string);
          return { id: r.id as string, starts_at, ends_at, reason: r.reason as string | null };
        }),
      };
    },
    decide: (id, approve) => mutate('decide_booking', { p_booking_id: id, p_approve: approve }),
    cancel: (id) => mutate('cancel_booking', { p_booking_id: id }),
    markAttendance: (id, attended) => mutate('mark_attendance', { p_booking_id: id, p_attended: attended }),
    reaffirmNoShow: (id) => mutate('reaffirm_no_show', { p_booking_id: id }),
    createManual: ({ phone, name, serviceIds, start }) =>
      mutate('create_manual_booking', {
        p_business_id: businessId, p_phone: phone, p_name: name, p_service_ids: serviceIds, p_start: start,
      }),
    async addBlock(from, to, reason) {
      if (!calendarId) {
        const { data } = await supabase.from('calendars').select('id').eq('business_id', businessId).single();
        calendarId = data?.id ?? null;
      }
      ownWrites.at = Date.now();
      const { error } = await supabase.from('calendar_exceptions').insert({
        business_id: businessId, calendar_id: calendarId, kind: 'block', during: `[${from},${to})`, reason: reason.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    async removeBlock(id) {
      ownWrites.at = Date.now();
      const { error } = await supabase.from('calendar_exceptions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    // ערוץ אחד לכל המאזינים (היומן ולשונית הבקשות). supabase.channel() מחזיר ערוץ קיים
    // לפי שם, ואסור להוסיף לו callbacks אחרי subscribe — לכן לא פותחים ערוץ לכל מאזין.
    subscribe(onChange) {
      listeners.add(onChange);
      if (!channel) {
        const emit = (isNew: boolean) => listeners.forEach((l) => l(isNew));
        channel = supabase
          .channel(`calendar-${businessId}-${crypto.randomUUID()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` },
            (p) => emit(p.eventType === 'INSERT' && Date.now() - ownWrites.at > 3000))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_exceptions', filter: `business_id=eq.${businessId}` },
            () => emit(false))
          .subscribe();
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && channel) {
          void supabase.removeChannel(channel);
          channel = null;
        }
      };
    },
  };
}

export function createCalendarApi(businessId: string): CalendarApi {
  return DEV_BYPASS ? createDemoApi(businessId) : createSupabaseApi(businessId);
}
