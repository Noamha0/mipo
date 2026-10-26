import { supabase } from './supabase';
import type { Business, Category } from './types';

/** עסק כפי שמוצג בגילוי: קבוצות הקטגוריות שלו, מחיר התחלתי, ומשבצות פנויות קרובות. */
export interface Listing {
  business: Business;
  groups: Set<string>;
  categoryNames: string[];
  minPrice: number | null;
  /** השירות הקצר ביותר — לפיו מחושבות המשבצות הקרובות בכרטיס */
  probeServiceId: string | null;
}

interface SvcRow {
  business_id: string;
  id: string;
  category_id: string;
  price: number | null;
  duration_min: number;
}

/** כל העסקים שמופיעים בחיפוש, עם הנתונים לכרטיסים. */
export async function loadListings(): Promise<{ listings: Listing[]; categories: Category[] }> {
  const [b, s, c] = await Promise.all([
    supabase.from('businesses').select('*').eq('status', 'listed').order('rating', { ascending: false, nullsFirst: false }),
    supabase.from('services').select('business_id,id,category_id,price,duration_min').eq('active', true),
    supabase.from('categories').select('*').order('sort_order'),
  ]);
  const categories = (c.data ?? []) as Category[];
  const catById = new Map(categories.map((x) => [x.id, x]));

  const byBiz = new Map<string, SvcRow[]>();
  for (const row of (s.data ?? []) as SvcRow[]) {
    const list = byBiz.get(row.business_id);
    if (list) list.push(row); else byBiz.set(row.business_id, [row]);
  }

  const listings = ((b.data ?? []) as Business[]).map((business) => {
    const svcs = byBiz.get(business.id) ?? [];
    const prices = svcs.map((x) => x.price).filter((p): p is number => p != null);
    const shortest = [...svcs].sort((x, y) => x.duration_min - y.duration_min)[0];
    const cats = svcs.map((x) => catById.get(x.category_id)).filter((x): x is Category => Boolean(x));
    return {
      business,
      groups: new Set(cats.map((x) => x.group_key)),
      categoryNames: [...new Set(cats.map((x) => x.name))],
      minPrice: prices.length ? Math.min(...prices) : null,
      probeServiceId: shortest?.id ?? null,
    };
  });
  return { listings, categories };
}

/**
 * המשבצות הפנויות הקרובות של עסק (היום ומחר), מתוך מנוע המשבצות האמיתי
 * (available_slots). כך התג "זמין היום" אמת ולא קישוט.
 */
export async function nextSlots(listing: Listing, limit = 3): Promise<string[]> {
  if (!listing.probeServiceId) return [];
  const { data } = await supabase.rpc('available_slots', {
    p_business_id: listing.business.id,
    p_service_ids: [listing.probeServiceId],
    p_days: 2,
  });
  return ((data ?? []) as { slot_start: string }[]).slice(0, limit).map((s) => s.slot_start);
}
