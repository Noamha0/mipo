import { supabase } from '../../lib/supabase';
import type { Business } from '../../lib/types';
import { DEV_BYPASS } from '../auth/useSession';
import type { BookingStatus } from '../biz/calendar/api';
import { demoMeApi } from './demoApi';

export type AltPreference = 'same_business' | 'other_business' | 'both';

/** שורה מ-my_bookings (0004) */
export interface MyBooking {
  id: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  business_phone: string | null;
  business_image: string | null;
  address_mode: 'studio' | 'home';
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  house_number: string | null;
  entrance_notes: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  total_price: number | null;
  approval_deadline: string | null;
  late_cancel: boolean;
  no_show_disputed_at: string | null;
  services: string | null;
  can_cancel: boolean;
  cancel_is_late: boolean;
  can_dispute: boolean;
}

export interface Profile {
  name: string | null;
  phone: string | null;
  alt_preference: AltPreference;
  attended: number;
  no_shows: number;
  late_cancels: number;
  score: number | null;
}

export interface MeApi {
  bookings(): Promise<MyBooking[]>;
  cancel(id: string): Promise<void>;
  dispute(id: string): Promise<void>;
  favorites(): Promise<Business[]>;
  favoriteIds(): Promise<string[]>;
  /** מחזיר true אם העסק במועדפים אחרי הלחיצה */
  toggleFavorite(businessId: string): Promise<boolean>;
  profile(): Promise<Profile>;
  saveProfile(p: { name: string; alt_preference: AltPreference }): Promise<void>;
}

const ERRORS: Record<string, string> = {
  not_cancellable: 'אי אפשר לבטל תור שכבר התחיל או הסתיים.',
  not_disputable: 'כבר נשלח ערעור על התור הזה.',
  authentication_required: 'צריך להתחבר כדי לעשות את זה.',
  phone_required: 'חסר מספר טלפון מאומת לחשבון.',
};

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : 'משהו השתבש. אפשר לנסות שוב.';
}

async function call<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

const supabaseMeApi: MeApi = {
  bookings: () => call(supabase.rpc('my_bookings')).then((d) => (d ?? []) as MyBooking[]),
  cancel: (id) => call(supabase.rpc('cancel_booking', { p_booking_id: id })).then(() => undefined),
  dispute: (id) => call(supabase.rpc('dispute_no_show', { p_booking_id: id })).then(() => undefined),
  async favorites() {
    const rows = await call(supabase.from('favorites').select('created_at, businesses(*)').order('created_at', { ascending: false }));
    return ((rows ?? []) as unknown as { businesses: Business | null }[]).map((r) => r.businesses).filter((b): b is Business => Boolean(b));
  },
  async favoriteIds() {
    const rows = await call(supabase.from('favorites').select('business_id'));
    return ((rows ?? []) as { business_id: string }[]).map((r) => r.business_id);
  },
  toggleFavorite: (businessId) => call(supabase.rpc('toggle_favorite', { p_business_id: businessId })).then((on) => Boolean(on)),
  async profile() {
    const c = await call(supabase.from('customers').select('id, name, phone, alt_preference').maybeSingle());
    if (!c) return { name: null, phone: null, alt_preference: 'both', attended: 0, no_shows: 0, late_cancels: 0, score: null };
    const r = await call(supabase.rpc('customer_reliability', { p_customer_id: c.id }).single());
    return { ...(c as Omit<Profile, 'attended' | 'no_shows' | 'late_cancels' | 'score'>), ...(r as Pick<Profile, 'attended' | 'no_shows' | 'late_cancels' | 'score'>) };
  },
  async saveProfile({ name, alt_preference }) {
    // claim_customer יוצרת את רשומת הלקוחה אם עוד אין (ומעדכנת את השם)
    await call(supabase.rpc('claim_customer', { p_name: name.trim() || null }));
    await call(supabase.from('customers').update({ alt_preference }).not('id', 'is', null));
  },
};

export const meApi: MeApi = DEV_BYPASS ? demoMeApi : supabaseMeApi;
