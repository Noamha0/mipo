-- ============================================================
-- 0003 — יומן העסק (אבן דרך 3)
-- קריאת היומן בשאילתה אחת: תורים + שם וטלפון הלקוחה כפי שהעסק מכיר
-- אותם + ציון אמינות. וגם Realtime לתורים ולחסימות.
-- כל הפעולות על תור (אישור, דחייה, ביטול, הגעה, קליטה ידנית) כבר קיימות ב-0001.
-- בטוח להרצה חוזרת.
-- ============================================================

-- תורים שחופפים לטווח, לצוות העסק בלבד. עד 62 יום בקריאה.
-- בקשה שעבר המועד לאישורה מוצגת כ-expired גם לפני שה-cron של אבן דרך 5 מסמן אותה.
create or replace function business_calendar(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id                     uuid,
  customer_id            uuid,
  starts_at              timestamptz,
  ends_at                timestamptz,
  status                 booking_status,
  source                 booking_source,
  total_price            numeric,
  approval_deadline      timestamptz,
  late_cancel            boolean,
  no_show_disputed_at    timestamptz,
  no_show_reaffirmed_at  timestamptz,
  created_at             timestamptz,
  customer_name          text,
  customer_phone         text,
  customer_notes         text,
  services               text,
  visits                 int,      -- תורים שהושלמו אצל העסק הזה
  attended               int,
  no_shows               int,
  late_cancels           int,
  score                  int       -- null = אין היסטוריה
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_business_member(p_business_id) then
    raise exception 'not_allowed';
  end if;
  if p_to <= p_from or p_to - p_from > interval '62 days' then
    raise exception 'invalid_range';
  end if;

  return query
  select bk.id, bk.customer_id, bk.starts_at, bk.ends_at,
         case when bk.status = 'pending' and bk.approval_deadline < now()
              then 'expired'::booking_status else bk.status end,
         bk.source, bk.total_price, bk.approval_deadline, bk.late_cancel,
         bk.no_show_disputed_at, bk.no_show_reaffirmed_at, bk.created_at,
         coalesce(bc.name, c.name), coalesce(bc.phone, c.phone), bc.notes,
         (select string_agg(bs.name, ' + ' order by bs.sort_order)
            from booking_services bs where bs.booking_id = bk.id),
         (select count(*)::int from bookings x
           where x.business_id = bk.business_id and x.customer_id = bk.customer_id and x.status = 'completed'),
         r.attended, r.no_shows, r.late_cancels, r.score
  from bookings bk
  join customers c on c.id = bk.customer_id
  left join business_customers bc on bc.business_id = bk.business_id and bc.customer_id = bk.customer_id
  cross join lateral reliability_stats(bk.customer_id) r
  where bk.business_id = p_business_id
    and bk.starts_at < p_to and bk.ends_at > p_from
  order by bk.starts_at;
end;
$$;

revoke execute on function business_calendar(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function business_calendar(uuid, timestamptz, timestamptz) to authenticated;

-- Realtime: היומן מתעדכן כשנכנסת הזמנה. RLS חל גם על השידור (bookings_member_read).
-- הפרסום קיים רק ב-Supabase, לא בבדיקות המקומיות.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['bookings', 'calendar_exceptions'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
