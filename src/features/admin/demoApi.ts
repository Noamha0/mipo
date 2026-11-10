// ⚠️ פיתוח בלבד: מסך אדמין על נתונים בזיכרון, פעיל רק כש-DEV_BYPASS דולק
// (אין משתמש אמיתי, אז ה-RPCs של האדמין היו מחזירים not_allowed). לא נטען ב-build לפרודקשן.
import { supabase } from '../../lib/supabase';
import type { Business } from '../../lib/types';
import type { AdminApi, AdminBusiness, AdminCustomer } from './api';

let store: Promise<{ businesses: AdminBusiness[]; customers: AdminCustomer[] }> | null = null;

async function seed() {
  const { data } = await supabase.from('businesses').select('*').limit(8);
  const businesses = ((data ?? []) as Business[]).map((b, i): AdminBusiness => ({
    id: b.id, slug: b.slug, name: b.name, status: i < 2 ? 'pending' : 'listed', city: b.city, neighborhood: b.neighborhood,
    phone: b.phone, owner_phone: '97250000000' + i, created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    services: i === 0 ? 'קוסם' : "לק ג'ל, פדיקור", other_services: i === 0 ? 1 : 0, bookings: i * 3,
  }));
  const customers: AdminCustomer[] = [
    { id: 'c1', name: 'הדר פרץ', phone: '972545556677', blocked_at: null, blocked_reason: null, bookings: 5, no_shows: 2, score: 50 },
  ];
  return { businesses, customers };
}
const s = () => (store ??= seed());

export const demoAdminApi: AdminApi = {
  isAdmin: async () => true,
  businesses: async () => {
    const order = { pending: 0, listed: 1, suspended: 2 };
    return [...(await s()).businesses].sort((a, b) => order[a.status] - order[b.status]);
  },
  async setStatus(id, status) {
    const b = (await s()).businesses.find((x) => x.id === id);
    if (!b) throw new Error('business_not_found');
    b.status = status;
  },
  findCustomer: async (phone) => (await s()).customers.find((c) => c.phone.endsWith(phone.replace(/\D/g, '').replace(/^0/, ''))) ?? null,
  async setCustomerBlock(phone, blocked, reason) {
    const c = await demoAdminApi.findCustomer(phone);
    if (!c) throw new Error('customer_not_found');
    Object.assign(c, { blocked_at: blocked ? new Date().toISOString() : null, blocked_reason: blocked ? reason || null : null });
  },
};
