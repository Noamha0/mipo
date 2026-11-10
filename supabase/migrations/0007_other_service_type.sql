-- ============================================================
-- 0007 — סוג שירות "אחר" בכל תחום
-- בעל עסק שהשירות שלו לא ברשימה בוחר את התחום ואז "אחר", ונותן לשירות
-- שם משלו. is_other מסמן את הקטגוריות האלה: הן לא מוצגות ללקוחות כתגית,
-- ולא משמשות להתאמת עסקים חלופיים (booking_alternatives).
-- בטוח להרצה חוזרת.
-- ============================================================

alter table categories add column if not exists is_other boolean not null default false;

insert into categories (group_key, name, sort_order, is_other)
select key, 'אחר (' || name || ')', 999, true
  from category_groups
on conflict (name) do update set is_other = true, sort_order = 999;

-- ---------- חלופות: בלי "אחר" ----------
-- זהה ל-0006, חוץ מבחירת הקטגוריות של התור.

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
  -- "אחר" לא מתאים עסקים זה לזה — רק סוגי שירות אמיתיים מהקטלוג
  select array_agg(distinct bs.category_id) into cats
    from booking_services bs join categories ct on ct.id = bs.category_id and not ct.is_other
   where bs.booking_id = bk.id;
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
