-- ============================================================
-- 0006 — פקיעה וחלופות (אבן דרך 5)
-- * בקשה שהעסק לא ענה עליה בזמן משחררת את השעה מיד: מנוע המשבצות
--   מתעלם ממנה, create_booking מפקיע לפני שהוא מנסה לתפוס את השעה,
--   ו-pg_cron מעדכן את הסטטוס בבסיס כל דקה.
-- * booking_alternatives: כשבקשה נדחתה, פקעה או בוטלה ע"י העסק,
--   הלקוחה מקבלת מועדים אחרים אצל אותו עסק ו/או עסקים אחרים באותו
--   תחום ובאותה עיר — לפי העדפת החלופות שלה (החלטה 7).
-- בטוח להרצה חוזרת.
-- ============================================================

-- ---------- מנוע המשבצות: בקשה שפקעה לא חוסמת ----------
-- זהה ל-0001, חוץ מהתנאי על pending שעבר את מועד האישור.

create or replace function available_slots(
  p_business_id uuid,
  p_service_ids uuid[],
  p_from date default null,
  p_days int default null
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'Asia/Jerusalem';
  b businesses%rowtype;
  cal_id uuid;
  dur int;
  today date := (now() at time zone tz)::date;
  d_from date;
  d_to date;
begin
  select * into b from businesses where id = p_business_id and status <> 'suspended';
  if not found then
    return;
  end if;
  select id into cal_id from calendars where business_id = b.id;
  dur := services_duration(b.id, p_service_ids);

  d_from := greatest(coalesce(p_from, today), today);
  d_to := least(d_from + coalesce(p_days, b.booking_horizon_days) - 1,
                today + b.booking_horizon_days - 1);
  if d_to < d_from then
    return;
  end if;

  return query
  with days as (
    select g::date as d from generate_series(d_from, d_to, interval '1 day') g
  ),
  windows as (
    select (dd.d + oh.opens) at time zone tz as ws,
           (dd.d + oh.closes) at time zone tz as we
    from days dd
    join open_hours oh on oh.calendar_id = cal_id and oh.weekday = extract(dow from dd.d)::int
    union
    select lower(ce.during), upper(ce.during)
    from calendar_exceptions ce
    where ce.calendar_id = cal_id and ce.kind = 'open'
      and ce.during && tstzrange(d_from::timestamp at time zone tz, (d_to + 1)::timestamp at time zone tz)
  ),
  candidates as (
    select distinct g as s
    from windows w,
         generate_series(w.ws, w.we - make_interval(mins => dur), interval '15 minutes') g
  )
  select c.s, c.s + make_interval(mins => dur)
  from candidates c
  where c.s >= now() + make_interval(mins => b.min_notice_minutes)
    and (c.s at time zone tz)::date between d_from and d_to
    and not exists (
      select 1 from bookings bk
      where bk.calendar_id = cal_id
        and bk.status in ('pending', 'confirmed', 'completed', 'no_show')
        and not (bk.status = 'pending' and bk.approval_deadline < now())
        and bk.occupied && tstzrange(c.s, c.s + make_interval(mins => dur + b.buffer_minutes))
    )
    and not exists (
      select 1 from calendar_exceptions ce
      where ce.calendar_id = cal_id and ce.kind = 'block'
        and ce.during && tstzrange(c.s, c.s + make_interval(mins => dur))
    )
  order by 1;
end;
$$;

-- ---------- create_booking: מפקיעים לפני שתופסים ----------
-- אילוץ החפיפה בטבלה עדיין רואה בקשה שפקעה כ-pending עד שהסטטוס מתעדכן,
-- אז מעדכנים אותו כאן ולא מחכים ל-pg_cron. זהה ל-0005 חוץ מהשורה הראשונה.

create or replace function create_booking(
  p_business_id uuid,
  p_service_ids uuid[],
  p_start timestamptz,
  p_name text default null,
  p_alt_preference alt_preference default null,
  p_source booking_source default 'link'
)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  c customers%rowtype;
begin
  perform expire_pending_bookings();

  select * into c from customers where user_id = auth.uid();
  if found then
    if c.blocked_at is not null then
      raise exception 'customer_blocked';
    end if;
    if exists (select 1 from business_blocked_customers where business_id = p_business_id and customer_id = c.id) then
      raise exception 'blocked_by_business';
    end if;
  end if;
  return create_booking_unchecked(p_business_id, p_service_ids, p_start, p_name, p_alt_preference, p_source);
end;
$$;

-- ---------- pg_cron: עדכון הסטטוס כל דקה ----------
-- רק איפה שההרחבה קיימת (ב-Supabase כן; בבדיקות PGlite לא).

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mipo-expire-pending', '* * * * *', 'select public.expire_pending_bookings()');
  end if;
end;
$$;

-- ---------- חלופות ----------
-- רק הלקוחה של התור. מחזיר שורות רק כשהתור לא יתקיים בגלל העסק
-- (נדחה / פקע / בוטל ע"י העסק). 'same' — עד p_limit מועדים קרובים אצל
-- אותו עסק לאותם שירותים. 'other' — עד 3 עסקים מופיעים בחיפוש, באותה עיר,
-- שיש להם שירות בכל אחת מהקטגוריות של התור, עם המועד הפנוי הראשון שלהם
-- בשבוע הקרוב. עסק שחסם את הלקוחה לא מוצע.

create or replace function booking_alternatives(p_booking_id uuid, p_limit int default 4)
returns table (
  kind            text,
  business_id     uuid,
  business_name   text,
  business_slug   text,
  business_image  text,
  city            text,
  neighborhood    text,
  service_ids     uuid[],
  services        text,
  total_price     numeric,
  slot_start      timestamptz
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  bk bookings%rowtype;
  home businesses%rowtype;
  pref alt_preference;
  cats uuid[];
  same_ids uuid[];
begin
  select * into bk from bookings where id = p_booking_id;
  if not found or bk.customer_id is distinct from current_customer_id() then
    raise exception 'not_allowed';
  end if;
  if not (bk.status in ('rejected', 'expired', 'cancelled_by_business')
          or (bk.status = 'pending' and bk.approval_deadline < now())) then
    return;
  end if;

  select alt_preference into pref from customers where id = bk.customer_id;
  select * into home from businesses where id = bk.business_id;
  select array_agg(distinct bs.category_id) into cats from booking_services bs where bs.booking_id = bk.id;
  -- אותם שירותים, אם כולם עדיין פעילים אצל העסק
  select case when count(*) = count(s.id) then array_agg(s.id order by bs.sort_order) end
    into same_ids
    from booking_services bs
    left join services s on s.id = bs.service_id and s.business_id = bk.business_id and s.active
   where bs.booking_id = bk.id;

  if pref in ('same_business', 'both')
     and same_ids is not null
     and home.status <> 'suspended'
     and not exists (select 1 from business_blocked_customers x
                     where x.business_id = home.id and x.customer_id = bk.customer_id) then
    return query
    select 'same'::text, home.id, home.name, home.slug, home.image_url, home.city, home.neighborhood,
           same_ids,
           (select string_agg(s.name, ' + ' order by array_position(same_ids, s.id)) from services s where s.id = any (same_ids)),
           (select sum(s.price) from services s where s.id = any (same_ids)),
           a.slot_start
      from available_slots(home.id, same_ids) a
     where a.slot_start <> bk.starts_at
     order by a.slot_start
     limit greatest(p_limit, 0);
  end if;

  if pref in ('other_business', 'both') and cats is not null then
    return query
    with c as (
      select b.*
        from businesses b
       where b.status = 'listed'
         and b.id <> home.id
         and (home.city is null or lower(trim(b.city)) = lower(trim(home.city)))
         and not exists (select 1 from business_blocked_customers x
                         where x.business_id = b.id and x.customer_id = bk.customer_id)
         and (select count(distinct s.category_id) from services s
               where s.business_id = b.id and s.active and s.category_id = any (cats)) = cardinality(cats)
       order by b.rating desc nulls last, b.id
       limit 20
    ),
    picked as (
      select c.id,
             array_agg(x.sid order by x.category_id) as ids,
             string_agg(x.sname, ' + ' order by x.category_id) as names,
             sum(x.price) as price
        from c
        cross join lateral (
          select distinct on (s.category_id) s.category_id, s.id as sid, s.name as sname, s.price
            from services s
           where s.business_id = c.id and s.active and s.category_id = any (cats)
           order by s.category_id, s.duration_min, s.id
        ) x
       group by c.id
    )
    select 'other'::text, c.id, c.name, c.slug, c.image_url, c.city, c.neighborhood,
           p.ids, p.names, p.price, f.first_slot
      from c
      join picked p on p.id = c.id
      cross join lateral (
        select min(a.slot_start) as first_slot from available_slots(c.id, p.ids, null, 7) a
      ) f
     where f.first_slot is not null
     order by f.first_slot
     limit 3;
  end if;
end;
$$;

revoke execute on function booking_alternatives(uuid, int) from public, anon;
grant execute on function booking_alternatives(uuid, int) to authenticated;
