import { supabase } from '../../lib/supabase';
import { DEV_BYPASS } from '../auth/useSession';
import { demoAdminApi } from './demoApi';

export type BusinessStatus = 'pending' | 'listed' | 'suspended';

/** שורה מ-admin_businesses (0008) */
export interface AdminBusiness {
  id: string;
  slug: string;
  name: string;
  status: BusinessStatus;
  city: string | null;
  neighborhood: string | null;
  phone: string | null;
  owner_phone: string | null;
  created_at: string;
  services: string | null;
  /** כמה שירותים בחרו "אחר" — מועמדים לסוג שירות חדש בקטלוג */
  other_services: number;
  bookings: number;
}

/** שורה מ-admin_find_customer (0008) */
export interface AdminCustomer {
  id: string;
  name: string | null;
  phone: string;
  blocked_at: string | null;
  blocked_reason: string | null;
  bookings: number;
  no_shows: number | null;
  score: number | null;
}

export interface AdminApi {
  isAdmin(): Promise<boolean>;
  businesses(): Promise<AdminBusiness[]>;
  setStatus(businessId: string, status: BusinessStatus, reason?: string): Promise<void>;
  findCustomer(phone: string): Promise<AdminCustomer | null>;
  setCustomerBlock(phone: string, blocked: boolean, reason?: string): Promise<void>;
}

const ERRORS: Record<string, string> = {
  not_allowed: 'אין לך הרשאת אדמין.',
  business_not_found: 'העסק לא נמצא.',
  customer_not_found: 'אין לקוח עם המספר הזה.',
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

const supabaseAdminApi: AdminApi = {
  isAdmin: () => call(supabase.rpc('is_platform_admin')).then(Boolean),
  businesses: () => call(supabase.rpc('admin_businesses')).then((d) => (d ?? []) as AdminBusiness[]),
  setStatus: (businessId, status, reason) =>
    call(supabase.rpc('admin_set_business_status', { p_business_id: businessId, p_status: status, p_reason: reason ?? null })).then(() => undefined),
  findCustomer: (phone) =>
    call(supabase.rpc('admin_find_customer', { p_phone: phone })).then((d) => ((d ?? []) as AdminCustomer[])[0] ?? null),
  setCustomerBlock: (phone, blocked, reason) =>
    call(supabase.rpc('admin_set_customer_block', { p_phone: phone, p_blocked: blocked, p_reason: reason ?? null })).then(() => undefined),
};

export const adminApi: AdminApi = DEV_BYPASS ? demoAdminApi : supabaseAdminApi;
