-- ============================================================
-- 0008 — מסך אדמין (הוקדם מאבן דרך 7)
-- * admin_businesses: כל העסקים, הממתינים לאישור קודם, עם טלפון הבעלים,
--   השירותים, כמה מהם "אחר" (מועמדים לסוג שירות חדש בקטלוג) וכמה תורים.
-- * admin_set_business_status: אישור להופעה בחיפוש / החזרה להמתנה / השעיה.
--   כל שינוי נרשם ב-audit_log.
-- * admin_find_customer: מה שהאדמין צריך לראות לפני חסימה לפי טלפון
--   (החסימה עצמה — admin_set_customer_block מ-0005).
-- רק ל-platform_admins. בטוח להרצה חוזרת.
-- ============================================================

create or replace function admin_businesses()
returns table (
  id              uuid,
  slug            text,
  name            text,
  status          business_status,
  city            text,
  neighborhood    text,
  phone           text,
  owner_phone     text,
  created_at      timestamptz,
  services        text,
  other_services  int,
  bookings        int
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  return query
  select b.id, b.slug, b.name, b.status, b.city, b.neighborhood, b.phone,
         (select u.phone::text from business_members m join auth.users u on u.id = m.user_id
           where m.business_id = b.id and m.is_owner limit 1),
         b.created_at,
         (select string_agg(s.name, ', ' order by s.sort_order, s.created_at)
            from services s where s.business_id = b.id and s.active),
         (select count(*)::int from services s join categories c on c.id = s.category_id
           where s.business_id = b.id and s.active and c.is_other),
         (select count(*)::int from bookings bk where bk.business_id = b.id)
    from businesses b
   order by case b.status when 'pending' then 0 when 'listed' then 1 else 2 end, b.created_at desc;
end;
$$;

create or replace function admin_set_business_status(p_business_id uuid, p_status business_status, p_reason text default null)
returns businesses language plpgsql volatile security definer set search_path = public as $$
declare
  b businesses%rowtype;
  old_status business_status;
begin
  if not is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  select status into old_status from businesses where id = p_business_id for update;
  if not found then
    raise exception 'business_not_found';
  end if;
  update businesses set status = p_status where id = p_business_id returning * into b;
  insert into audit_log (business_id, actor, action, data)
  values (p_business_id, auth.uid(), 'business_status',
          jsonb_build_object('from', old_status, 'to', p_status, 'reason', nullif(trim(p_reason), '')));
  return b;
end;
$$;

create or replace function admin_find_customer(p_phone text)
returns table (
  id              uuid,
  name            text,
  phone           text,
  blocked_at      timestamptz,
  blocked_reason  text,
  bookings        int,
  no_shows        int,
  score           int
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  return query
  select c.id, c.name, c.phone, c.blocked_at, c.blocked_reason,
         (select count(*)::int from bookings bk where bk.customer_id = c.id),
         r.no_shows::int, r.score::int
    from customers c
    left join lateral reliability_stats(c.id) r on true
   where c.phone = normalize_il_phone(p_phone);
end;
$$;

revoke execute on function admin_businesses() from public, anon;
grant execute on function admin_businesses() to authenticated;
revoke execute on function admin_set_business_status(uuid, business_status, text) from public, anon;
grant execute on function admin_set_business_status(uuid, business_status, text) to authenticated;
revoke execute on function admin_find_customer(text) from public, anon;
grant execute on function admin_find_customer(text) to authenticated;
-- המסך שואל אם להציג את עצמו
grant execute on function is_platform_admin() to authenticated;
