-- ============================================================
-- 0004 — צד הלקוחה (אבן דרך 4): "התורים שלי" ומועדפים.
-- ביטול וערעור כבר קיימים ב-0001 (cancel_booking, dispute_no_show),
-- והעדפת חלופות היא customers.alt_preference (עריכה עצמית מותרת).
-- בטוח להרצה חוזרת.
-- ============================================================

create table if not exists favorites (
  customer_id  uuid not null references customers(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (customer_id, business_id)
);

alter table favorites enable row level security;

drop policy if exists favorites_self_read on favorites;
create policy favorites_self_read on favorites
  for select using (customer_id = current_customer_id());
drop policy if exists favorites_self_delete on favorites;
create policy favorites_self_delete on favorites
  for delete using (customer_id = current_customer_id());
-- הוספה רק דרך toggle_favorite, שגם יוצרת את רשומת הלקוחה אם צריך

-- מוסיף או מסיר מהמועדפים. מחזיר true אם העסק במועדפים אחרי הקריאה.
create or replace function toggle_favorite(p_business_id uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  cid uuid;
begin
  if not exists (select 1 from businesses where id = p_business_id and status <> 'suspended') then
    raise exception 'business_not_found';
  end if;
  cid := claim_customer(null);
  delete from favorites where customer_id = cid and business_id = p_business_id;
  if found then
    return false;
  end if;
  insert into favorites (customer_id, business_id) values (cid, p_business_id);
  return true;
end;
$$;

-- התורים של הלקוחה המחוברת, עם מה שצריך לכרטיס: פרטי העסק, כתובת מלאה רק כשמותר
-- (סטודיו תמיד, עסק מהבית רק אחרי אישור — החלטה 15), ומה מותר לעשות עכשיו.
create or replace function my_bookings()
returns table (
  id                   uuid,
  business_id          uuid,
  business_name        text,
  business_slug        text,
  business_phone       text,
  business_image       text,
  address_mode         address_mode,
  city                 text,
  neighborhood         text,
  street               text,     -- null = הכתובת עוד לא נחשפת
  house_number         text,
  entrance_notes       text,
  starts_at            timestamptz,
  ends_at              timestamptz,
  status               booking_status,
  total_price          numeric,
  approval_deadline    timestamptz,
  late_cancel          boolean,
  no_show_disputed_at  timestamptz,
  services             text,
  can_cancel           boolean,
  cancel_is_late       boolean,  -- ביטול עכשיו ייחשב מאוחר
  can_dispute          boolean
)
language sql stable security definer set search_path = public as $$
  select bk.id, b.id, b.name, b.slug, b.phone, b.image_url, b.address_mode, b.city, b.neighborhood,
         case when revealed then coalesce(bp.street, b.street_public) end,
         case when revealed then bp.house_number end,
         case when revealed then bp.entrance_notes end,
         bk.starts_at, bk.ends_at,
         case when bk.status = 'pending' and bk.approval_deadline < now()
              then 'expired'::booking_status else bk.status end,
         bk.total_price, bk.approval_deadline, bk.late_cancel, bk.no_show_disputed_at,
         (select string_agg(bs.name, ' + ' order by bs.sort_order) from booking_services bs where bs.booking_id = bk.id),
         bk.status in ('pending', 'confirmed') and bk.starts_at > now()
           and not (bk.status = 'pending' and bk.approval_deadline < now()),
         bk.status = 'confirmed' and now() > bk.starts_at - make_interval(hours => b.cancel_window_hours),
         bk.status = 'no_show' and bk.no_show_disputed_at is null
  from bookings bk
  join businesses b on b.id = bk.business_id
  left join business_private bp on bp.business_id = b.id
  cross join lateral (
    select b.address_mode = 'studio' or bk.status in ('confirmed', 'completed') as revealed
  ) r
  where bk.customer_id = current_customer_id()
  order by bk.starts_at desc
  limit 200;
$$;

revoke execute on function toggle_favorite(uuid) from public, anon;
grant execute on function toggle_favorite(uuid) to authenticated;
revoke execute on function my_bookings() from public, anon;
grant execute on function my_bookings() to authenticated;
