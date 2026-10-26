-- ============================================================
-- 0001 — Foundation: businesses, calendar, catalog, bookings
-- RLS is the security layer (client talks to Postgres directly).
-- Every state change of a booking goes through a security-definer
-- RPC below; clients never insert/update bookings directly.
-- All wall-clock logic is in Asia/Jerusalem.
-- ============================================================

create extension if not exists btree_gist;  -- uuid "=" inside the exclusion constraint

-- ---------- Enums ----------

create type business_status as enum (
  'pending',    -- הלינק האישי עובד, לא מופיע בחיפוש (החלטה 16)
  'listed',     -- אושר ע"י אדמין — מופיע בחיפוש
  'suspended'   -- מושעה — לא נגיש בכלל
);

create type address_mode as enum ('studio', 'home');  -- החלטה 15

create type booking_status as enum (
  'pending',                -- ממתין לאישור העסק (המשבצת חסומה)
  'confirmed',
  'rejected',               -- העסק דחה
  'expired',                -- העסק לא ענה בזמן — שוחרר (החלטה 4)
  'cancelled_by_customer',
  'cancelled_by_business',
  'completed',              -- הגיעה
  'no_show'                 -- לא הגיעה
);

create type booking_source as enum ('link', 'search', 'manual');  -- החלטה 9: מתעדים מקור
create type alt_preference as enum ('same_business', 'other_business', 'both');  -- החלטה 7
create type exception_kind as enum ('block', 'open');

-- statuses that occupy the calendar
-- (kept in sync with the exclusion constraint and available_slots)

-- ---------- Catalog (החלטה 5) ----------

create table category_groups (
  key         text primary key,
  name        text not null,
  sort_order  int not null default 0
);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  group_key   text not null references category_groups(key),
  name        text not null unique,
  active      boolean not null default true,
  sort_order  int not null default 0
);

-- ---------- Businesses ----------

create table businesses (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name                      text not null,
  phone                     text,
  description               text,
  instagram_url             text,
  status                    business_status not null default 'pending',
  verified_at               timestamptz,
  -- כתובת ציבורית. בעסק מהבית: עיר + שכונה בלבד, נקודה משוערת (החלטה 15)
  address_mode              address_mode not null default 'studio',
  city                      text,
  neighborhood              text,
  street_public             text,
  approx_lat                double precision,
  approx_lng                double precision,
  -- כללי הזמנה (החלטות 3, 4, 6, 13, 14)
  booking_horizon_days      int not null default 7   check (booking_horizon_days between 7 and 60),
  min_notice_minutes        int not null default 120 check (min_notice_minutes >= 0),
  buffer_minutes            int not null default 0   check (buffer_minutes between 0 and 120),
  cancel_window_hours       int not null default 24  check (cancel_window_hours between 0 and 168),
  require_approval_all      boolean not null default false,
  require_approval_new      boolean not null default false,
  min_reliability_pct       int check (min_reliability_pct between 0 and 100),
  approval_timeout_minutes  int not null default 60  check (approval_timeout_minutes between 15 and 240),
  created_at                timestamptz not null default now()
);

-- כתובת מלאה — נחשפת לסטודיו תמיד, לעסק מהבית רק אחרי תור מאושר
create table business_private (
  business_id     uuid primary key references businesses(id) on delete cascade,
  street          text,
  house_number    text,
  entrance_notes  text,
  lat             double precision,
  lng             double precision
);

create table business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  is_owner     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (business_id, user_id)
);

-- יומן אחד לכל עסק (החלטה 10). טבלה נפרדת כדי שעובדות נוספות לא ידרשו כתיבה מחדש.
create table calendars (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null unique references businesses(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- שעות פעילות שבועיות; כמה שורות ליום = משמרות מפוצלות
create table open_hours (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  calendar_id  uuid not null references calendars(id) on delete cascade,
  weekday      int not null check (weekday between 0 and 6),  -- 0 = ראשון
  opens        time not null,
  closes       time not null,
  check (closes > opens)
);

-- חסימות (חופש/חג) ושעות חריגות נוספות
create table calendar_exceptions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  calendar_id  uuid not null references calendars(id) on delete cascade,
  kind         exception_kind not null,
  during       tstzrange not null check (not isempty(during)),
  reason       text,
  created_at   timestamptz not null default now()
);

create table services (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  category_id   uuid not null references categories(id),
  name          text not null,
  description   text,
  price         numeric(10,2) check (price >= 0),
  duration_min  int not null check (duration_min between 5 and 600),
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- Customers (החלטה 12) ----------

-- זהות גלובלית לפי טלפון. user_id ריק = "לקוחה זמנית" שנוצרה מקליטה ידנית,
-- ומשויכת אוטומטית כשנרשמת עם אותו טלפון.
create table customers (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique check (phone ~ '^972[0-9]{8,9}$'),
  user_id         uuid unique references auth.users(id) on delete set null,
  name            text,
  alt_preference  alt_preference not null default 'both',
  created_at      timestamptz not null default now()
);

-- מה שהעסק יודע על לקוחה: רק מי שקבעה אצלו, בשם שהוא נתן לה.
create table business_customers (
  business_id  uuid not null references businesses(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  name         text,
  phone        text not null,
  notes        text,
  created_at   timestamptz not null default now(),
  primary key (business_id, customer_id)
);

-- ---------- Bookings ----------

create table bookings (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references businesses(id) on delete cascade,
  calendar_id            uuid not null references calendars(id) on delete cascade,
  customer_id            uuid not null references customers(id) on delete cascade,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  -- זמן תפוס ביומן = משך השירותים + מרווח הניקוי של העסק
  occupied               tstzrange not null,
  status                 booking_status not null,
  source                 booking_source not null,
  alt_preference         alt_preference not null default 'both',  -- תמונת מצב בזמן ההזמנה
  total_price            numeric(10,2),
  approval_deadline      timestamptz,
  decided_at             timestamptz,
  cancelled_at           timestamptz,
  late_cancel            boolean not null default false,
  no_show_disputed_at    timestamptz,
  no_show_reaffirmed_at  timestamptz,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at > starts_at),
  check (lower(occupied) = starts_at and upper(occupied) >= ends_at),
  check (status <> 'pending' or approval_deadline is not null),
  -- הלב של הבטחת הוודאות: בסיס הנתונים עצמו מסרב לחפיפה (החלטה 19)
  constraint bookings_no_overlap exclude using gist (
    calendar_id with =,
    occupied with &&
  ) where (status in ('pending', 'confirmed', 'completed', 'no_show'))
);

create table booking_services (
  booking_id    uuid not null references bookings(id) on delete cascade,
  service_id    uuid references services(id) on delete set null,
  category_id   uuid not null references categories(id),
  name          text not null,
  duration_min  int not null,
  price         numeric(10,2),
  sort_order    int not null default 0,
  primary key (booking_id, sort_order)
);

create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  booking_id   uuid references bookings(id) on delete set null,
  actor        uuid,
  action       text not null,
  data         jsonb,
  created_at   timestamptz not null default now()
);

-- ---------- Indexes ----------

create index idx_members_user          on business_members (user_id);
create index idx_open_hours_calendar   on open_hours (calendar_id, weekday);
create index idx_exceptions_calendar   on calendar_exceptions using gist (calendar_id, during);
create index idx_services_business     on services (business_id) where active;
create index idx_services_category     on services (category_id) where active;
create index idx_bookings_business_day on bookings (business_id, starts_at);
create index idx_bookings_customer     on bookings (customer_id, starts_at);
create index idx_bookings_pending      on bookings (approval_deadline) where status = 'pending';
create index idx_audit_booking         on audit_log (booking_id);

-- ---------- Helpers ----------

-- 050-1234567 / +972-50-1234567 → 972501234567 (פורמט auth.users.phone של Supabase)
create or replace function normalize_il_phone(raw text)
returns text language plpgsql immutable as $$
declare
  digits text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
begin
  if digits like '972%' then return digits; end if;
  if digits like '0%' then return '972' || substr(digits, 2); end if;
  return '972' || digits;
end;
$$;

create or replace function is_business_member(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members where business_id = bid and user_id = auth.uid()
  );
$$;

create or replace function is_business_owner(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members where business_id = bid and user_id = auth.uid() and is_owner
  );
$$;

create or replace function current_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from customers where user_id = auth.uid();
$$;

-- סכום משכי השירותים בסל; זורק אם שירות לא שייך לעסק / לא פעיל
create or replace function services_duration(p_business_id uuid, p_service_ids uuid[])
returns int language plpgsql stable security definer set search_path = public as $$
declare
  total int;
  found_count int;
  wanted int := (select count(distinct x) from unnest(p_service_ids) x);
begin
  select coalesce(sum(duration_min), 0), count(*) into total, found_count
  from services
  where business_id = p_business_id and active and id = any (p_service_ids);

  if wanted = 0 or found_count <> wanted then
    raise exception 'invalid_services';
  end if;
  return total;
end;
$$;

-- ---------- Slot engine (החלטה 14) ----------

-- משבצות פנויות לסל שירותים. כל 15 דקות מתחילת כל חלון פעילות,
-- בתוך אופק ההזמנה, אחרי זמן ההתראה המינימלי, בלי חפיפה לתור פעיל
-- (כולל מרווח הניקוי) ובלי חפיפה לחסימה.
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

-- ---------- Reliability (החלטות 6, 13) ----------

-- 12 חודשים אחרונים. ביטול מאוחר שוקל חצי מאי-הגעה.
-- אי-הגעה בערעור לא נספרת עד שהעסק מאשר אותה שוב.
-- פנימית בלבד — החשיפה דרך customer_reliability.
create or replace function reliability_stats(p_customer_id uuid)
returns table (attended int, no_shows int, late_cancels int, score int)
language sql stable security definer set search_path = public as $$
  with h as (
    select
      count(*) filter (where status = 'completed')::int as a,
      count(*) filter (where status = 'no_show'
                       and (no_show_disputed_at is null or no_show_reaffirmed_at is not null))::int as n,
      count(*) filter (where status = 'cancelled_by_customer' and late_cancel)::int as l
    from bookings
    where customer_id = p_customer_id and starts_at > now() - interval '12 months'
  )
  select a, n, l,
         case when a + n + l = 0 then null
              else round(100.0 * a / (a + n + 0.5 * l))::int end
  from h;
$$;

-- הלקוחה רואה את הציון של עצמה; עסק — רק של מי שקבעה אצלו
create or replace function customer_reliability(p_customer_id uuid, p_business_id uuid default null)
returns table (attended int, no_shows int, late_cancels int, score int)
language plpgsql stable security definer set search_path = public as $$
begin
  -- coalesce: למשתמש בלי רשומת לקוחה current_customer_id() הוא null,
  -- ו-"not null" היה מדלג על החסימה
  if not coalesce(
    p_customer_id = current_customer_id()
    or (p_business_id is not null
        and is_business_member(p_business_id)
        and exists (select 1 from bookings
                    where business_id = p_business_id and customer_id = p_customer_id)),
    false
  ) then
    raise exception 'not_allowed';
  end if;
  return query select * from reliability_stats(p_customer_id);
end;
$$;

-- ---------- Approval deadline (החלטה 4) ----------

-- X דקות של שעות פעילות מרגע ההזמנה (הזמנה בלילה — השעון מתחיל בפתיחה),
-- אבל לא יאוחר משעה לפני התור, ולא פחות מ-15 דקות.
create or replace function approval_deadline(p_business_id uuid, p_created timestamptz, p_start timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'Asia/Jerusalem';
  remaining int;
  cur timestamptz := p_created;
  d date := (p_created at time zone tz)::date;
  walked timestamptz;
  w record;
begin
  select approval_timeout_minutes into remaining from businesses where id = p_business_id;

  for i in 0..13 loop
    for w in
      select ((d + i) + oh.opens) at time zone tz as ws,
             ((d + i) + oh.closes) at time zone tz as we
      from open_hours oh
      join calendars c on c.id = oh.calendar_id
      where c.business_id = p_business_id and oh.weekday = extract(dow from d + i)::int
      order by oh.opens
    loop
      continue when w.we <= cur;
      cur := greatest(cur, w.ws);
      if cur + make_interval(mins => remaining) <= w.we then
        walked := cur + make_interval(mins => remaining);
        exit;
      end if;
      remaining := remaining - floor(extract(epoch from (w.we - cur)) / 60)::int;
      cur := w.we;
    end loop;
    exit when walked is not null;
  end loop;

  walked := coalesce(walked, p_created + make_interval(mins => remaining));  -- אין שעות מוגדרות
  return greatest(least(walked, p_start - interval '60 minutes'),
                  p_created + interval '15 minutes');
end;
$$;

-- ---------- Customer identity ----------

-- מחזיר את רשומת הלקוחה של המשתמש המחובר; משייך לקוחה זמנית (מקליטה ידנית)
-- לפי הטלפון המאומת, או יוצר חדשה.
create or replace function claim_customer(p_name text default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  verified_phone text;
  cid uuid;
begin
  if uid is null then
    raise exception 'authentication_required';
  end if;

  select id into cid from customers where user_id = uid;
  if cid is not null then
    update customers set name = coalesce(nullif(trim(p_name), ''), name) where id = cid;
    return cid;
  end if;

  select normalize_il_phone(phone) into verified_phone from auth.users where id = uid;
  if verified_phone is null or verified_phone = '972' then
    raise exception 'phone_required';
  end if;

  update customers
     set user_id = uid, name = coalesce(nullif(trim(p_name), ''), name)
   where phone = verified_phone and user_id is null
  returning id into cid;

  if cid is null then
    insert into customers (phone, user_id, name)
    values (verified_phone, uid, nullif(trim(p_name), ''))
    returning id into cid;
  end if;
  return cid;
end;
$$;

-- ---------- Booking RPCs ----------

-- הזמנה של לקוחה (מהלינק או מהחיפוש)
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
  b businesses%rowtype;
  cid uuid;
  cust customers%rowtype;
  cal_id uuid;
  dur int;
  rel int;
  needs_approval boolean;
  bk bookings%rowtype;
begin
  if p_source = 'manual' then
    raise exception 'invalid_source';
  end if;

  select * into b from businesses where id = p_business_id and status <> 'suspended';
  if not found then
    raise exception 'business_not_found';
  end if;
  select id into cal_id from calendars where business_id = b.id;

  -- בשתי שורות בכוונה: claim_customer עשויה להכניס שורה, ו-snapshot של שאילתה
  -- שקוראת לה ב-WHERE לא היה רואה אותה
  cid := claim_customer(p_name);
  select * into cust from customers where id = cid;
  if p_alt_preference is not null and p_alt_preference <> cust.alt_preference then
    update customers set alt_preference = p_alt_preference where id = cust.id
    returning * into cust;
  end if;

  dur := services_duration(b.id, p_service_ids);
  if not exists (
    select 1 from available_slots(b.id, p_service_ids, (p_start at time zone 'Asia/Jerusalem')::date, 1) s
    where s.slot_start = p_start
  ) then
    raise exception 'slot_unavailable';
  end if;

  select score into rel from reliability_stats(cust.id);
  needs_approval :=
       b.require_approval_all
    or (b.require_approval_new and not exists (
          select 1 from bookings x
          where x.business_id = b.id and x.customer_id = cust.id and x.status = 'completed'))
    or (b.min_reliability_pct is not null and rel is not null and rel < b.min_reliability_pct);

  insert into bookings (business_id, calendar_id, customer_id, starts_at, ends_at, occupied,
                        status, source, alt_preference, total_price, approval_deadline, created_by)
  select b.id, cal_id, cust.id, p_start,
         p_start + make_interval(mins => dur),
         tstzrange(p_start, p_start + make_interval(mins => dur + b.buffer_minutes)),
         case when needs_approval then 'pending' else 'confirmed' end::booking_status,
         p_source, cust.alt_preference,
         (select sum(price) from services where id = any (p_service_ids)),
         case when needs_approval then approval_deadline(b.id, now(), p_start) end,
         auth.uid()
  returning * into bk;

  insert into booking_services (booking_id, service_id, category_id, name, duration_min, price, sort_order)
  select bk.id, s.id, s.category_id, s.name, s.duration_min, s.price, row_number() over (order by s.sort_order, s.name)
  from services s where s.id = any (p_service_ids);

  insert into business_customers (business_id, customer_id, name, phone)
  values (b.id, cust.id, cust.name, cust.phone)
  on conflict (business_id, customer_id) do nothing;

  return bk;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
end;
$$;

-- קליטה ידנית של תור מוואטסאפ/טלפון — מאושר מיד, משויך ללקוחה לפי טלפון (החלטה 12).
-- לא בודק שעות פעילות (העסק מחליט), רק חפיפה.
create or replace function create_manual_booking(
  p_business_id uuid,
  p_phone text,
  p_name text,
  p_service_ids uuid[],
  p_start timestamptz
)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  b businesses%rowtype;
  cal_id uuid;
  cid uuid;
  ph text := normalize_il_phone(p_phone);
  dur int;
  bk bookings%rowtype;
begin
  if not is_business_member(p_business_id) then
    raise exception 'not_allowed';
  end if;
  select * into b from businesses where id = p_business_id;
  select id into cal_id from calendars where business_id = b.id;
  dur := services_duration(b.id, p_service_ids);

  insert into customers (phone, name) values (ph, nullif(trim(p_name), ''))
  on conflict (phone) do nothing;
  select id into cid from customers where phone = ph;

  insert into bookings (business_id, calendar_id, customer_id, starts_at, ends_at, occupied,
                        status, source, total_price, created_by)
  values (b.id, cal_id, cid, p_start,
          p_start + make_interval(mins => dur),
          tstzrange(p_start, p_start + make_interval(mins => dur + b.buffer_minutes)),
          'confirmed', 'manual',
          (select sum(price) from services where id = any (p_service_ids)),
          auth.uid())
  returning * into bk;

  insert into booking_services (booking_id, service_id, category_id, name, duration_min, price, sort_order)
  select bk.id, s.id, s.category_id, s.name, s.duration_min, s.price, row_number() over (order by s.sort_order, s.name)
  from services s where s.id = any (p_service_ids);

  -- השם שהעסק נותן הוא התווית שלו בלבד — לא דורס את שם הלקוחה הגלובלי
  insert into business_customers (business_id, customer_id, name, phone)
  values (b.id, cid, nullif(trim(p_name), ''), ph)
  on conflict (business_id, customer_id)
  do update set name = coalesce(excluded.name, business_customers.name);

  return bk;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
end;
$$;

-- אישור / דחייה ע"י העסק
create or replace function decide_booking(p_booking_id uuid, p_approve boolean)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  bk bookings%rowtype;
begin
  select * into bk from bookings where id = p_booking_id for update;
  if not found or not is_business_member(bk.business_id) then
    raise exception 'not_allowed';
  end if;
  if bk.status <> 'pending' then
    raise exception 'not_pending';
  end if;
  if bk.approval_deadline < now() then
    raise exception 'approval_expired';
  end if;

  update bookings
     set status = case when p_approve then 'confirmed' else 'rejected' end::booking_status,
         decided_at = now()
   where id = bk.id
  returning * into bk;
  return bk;
end;
$$;

-- ביטול: לקוחה (מאוחר = בתוך חלון הביטול של העסק) או עסק
create or replace function cancel_booking(p_booking_id uuid)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  bk bookings%rowtype;
  b businesses%rowtype;
begin
  select * into bk from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;
  if bk.status not in ('pending', 'confirmed') or bk.starts_at <= now() then
    raise exception 'not_cancellable';
  end if;
  select * into b from businesses where id = bk.business_id;

  if bk.customer_id = current_customer_id() then
    update bookings
       set status = 'cancelled_by_customer',
           cancelled_at = now(),
           late_cancel = (bk.status = 'confirmed'
                          and now() > bk.starts_at - make_interval(hours => b.cancel_window_hours))
     where id = bk.id
    returning * into bk;
  elsif is_business_member(bk.business_id) then
    update bookings set status = 'cancelled_by_business', cancelled_at = now()
     where id = bk.id
    returning * into bk;
  else
    raise exception 'not_allowed';
  end if;
  return bk;
end;
$$;

-- סימון הגעה / אי-הגעה אחרי תחילת התור (אפשר לתקן סימון קודם)
create or replace function mark_attendance(p_booking_id uuid, p_attended boolean)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  bk bookings%rowtype;
begin
  select * into bk from bookings where id = p_booking_id for update;
  if not found or not is_business_member(bk.business_id) then
    raise exception 'not_allowed';
  end if;
  if bk.status not in ('confirmed', 'completed', 'no_show') or bk.starts_at > now() then
    raise exception 'not_markable';
  end if;

  update bookings
     set status = case when p_attended then 'completed' else 'no_show' end::booking_status,
         no_show_disputed_at = case when p_attended then null else no_show_disputed_at end,
         no_show_reaffirmed_at = case when p_attended then null else no_show_reaffirmed_at end
   where id = bk.id
  returning * into bk;
  return bk;
end;
$$;

-- ערעור הלקוחה על אי-הגעה ("הגעתי") — מוציא אותה מהציון עד שהעסק מאשר שוב
create or replace function dispute_no_show(p_booking_id uuid)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  bk bookings%rowtype;
begin
  select * into bk from bookings where id = p_booking_id for update;
  if not found or bk.customer_id is distinct from current_customer_id() then
    raise exception 'not_allowed';
  end if;
  if bk.status <> 'no_show' or bk.no_show_disputed_at is not null then
    raise exception 'not_disputable';
  end if;
  update bookings set no_show_disputed_at = now() where id = bk.id returning * into bk;
  return bk;
end;
$$;

create or replace function reaffirm_no_show(p_booking_id uuid)
returns bookings language plpgsql volatile security definer set search_path = public as $$
declare
  bk bookings%rowtype;
begin
  select * into bk from bookings where id = p_booking_id for update;
  if not found or not is_business_member(bk.business_id) then
    raise exception 'not_allowed';
  end if;
  if bk.status <> 'no_show' or bk.no_show_disputed_at is null or bk.no_show_reaffirmed_at is not null then
    raise exception 'not_disputed';
  end if;
  update bookings set no_show_reaffirmed_at = now() where id = bk.id returning * into bk;
  return bk;
end;
$$;

-- פקיעת הזמנות שלא נענו בזמן; מתוזמן ב-pg_cron באבן דרך 5
create or replace function expire_pending_bookings()
returns int language sql volatile security definer set search_path = public as $$
  with x as (
    update bookings set status = 'expired', decided_at = now()
    where status = 'pending' and approval_deadline < now()
    returning 1
  )
  select count(*)::int from x;
$$;

-- ---------- Bootstrap: הקמת עסק ----------

create or replace function create_business(p_slug text, p_name text, p_phone text default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  bid uuid;
  cal uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  insert into businesses (slug, name, phone) values (lower(p_slug), p_name, p_phone) returning id into bid;
  insert into business_private (business_id) values (bid);
  insert into business_members (business_id, user_id, is_owner) values (bid, auth.uid(), true);
  insert into calendars (business_id) values (bid) returning id into cal;

  -- ברירת מחדל: א'–ה' 09:00–19:00, ו' 08:00–13:00. העסק משנה באשף ההקמה.
  insert into open_hours (business_id, calendar_id, weekday, opens, closes)
  select bid, cal, wd, time '09:00', time '19:00' from generate_series(0, 4) wd
  union all
  select bid, cal, 5, time '08:00', time '13:00';

  return bid;
end;
$$;

-- ---------- Triggers ----------

create or replace function bookings_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_bookings_before_update
  before update on bookings
  for each row execute function bookings_before_update();

create or replace function bookings_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_log (business_id, booking_id, actor, action, data)
    values (new.business_id, new.id, auth.uid(), 'created',
            jsonb_build_object('status', new.status, 'source', new.source));
  elsif new.status is distinct from old.status
     or new.no_show_disputed_at is distinct from old.no_show_disputed_at
     or new.no_show_reaffirmed_at is distinct from old.no_show_reaffirmed_at then
    insert into audit_log (business_id, booking_id, actor, action, data)
    values (new.business_id, new.id, auth.uid(), 'status_change',
            jsonb_build_object('from', old.status, 'to', new.status,
                               'disputed', new.no_show_disputed_at is not null,
                               'reaffirmed', new.no_show_reaffirmed_at is not null));
  end if;
  return new;
end;
$$;

create trigger trg_bookings_audit
  after insert or update on bookings
  for each row execute function bookings_audit();

-- ---------- Row Level Security ----------

alter table category_groups     enable row level security;
alter table categories          enable row level security;
alter table businesses          enable row level security;
alter table business_private    enable row level security;
alter table business_members    enable row level security;
alter table calendars           enable row level security;
alter table open_hours          enable row level security;
alter table calendar_exceptions enable row level security;
alter table services            enable row level security;
alter table customers           enable row level security;
alter table business_customers  enable row level security;
alter table bookings            enable row level security;
alter table booking_services    enable row level security;
alter table audit_log           enable row level security;

-- קטלוג: ציבורי לקריאה; ניהול רק דרך אדמין (service role) באבן דרך 7
create policy category_groups_read on category_groups for select using (true);
create policy categories_read on categories for select using (true);

-- businesses: פרופיל ציבורי (הלינק האישי עובד גם ב-pending); בעלים מעדכן
create policy businesses_public_read on businesses
  for select using (status <> 'suspended' or is_business_member(id));
create policy businesses_owner_update on businesses
  for update using (is_business_owner(id)) with check (is_business_owner(id));

-- business_private: סטודיו — ציבורי; מהבית — לצוות וללקוחה עם תור מאושר
create policy business_private_read on business_private
  for select using (
    is_business_member(business_id)
    or exists (select 1 from businesses b
               where b.id = business_id and b.address_mode = 'studio' and b.status <> 'suspended')
    or exists (select 1 from bookings bk
               where bk.business_id = business_private.business_id
                 and bk.customer_id = current_customer_id()
                 and bk.status in ('confirmed', 'completed'))
  );
create policy business_private_member_update on business_private
  for update using (is_business_member(business_id)) with check (is_business_member(business_id));

create policy members_read on business_members
  for select using (is_business_member(business_id));

create policy calendars_read on calendars for select using (true);

-- שעות פעילות ציבוריות (מוצגות בפרופיל); עריכה לצוות
create policy open_hours_read on open_hours for select using (true);
create policy open_hours_member_insert on open_hours
  for insert with check (is_business_member(business_id)
                         and calendar_id = (select id from calendars where business_id = open_hours.business_id));
create policy open_hours_member_update on open_hours
  for update using (is_business_member(business_id))
  with check (is_business_member(business_id)
              and calendar_id = (select id from calendars where business_id = open_hours.business_id));
create policy open_hours_member_delete on open_hours
  for delete using (is_business_member(business_id));

-- חסימות פרטיות (הסיבה לא ציבורית) — הזמינות נחשפת רק דרך available_slots
create policy exceptions_member_read on calendar_exceptions
  for select using (is_business_member(business_id));
create policy exceptions_member_insert on calendar_exceptions
  for insert with check (is_business_member(business_id)
                         and calendar_id = (select id from calendars where business_id = calendar_exceptions.business_id));
create policy exceptions_member_update on calendar_exceptions
  for update using (is_business_member(business_id))
  with check (is_business_member(business_id)
              and calendar_id = (select id from calendars where business_id = calendar_exceptions.business_id));
create policy exceptions_member_delete on calendar_exceptions
  for delete using (is_business_member(business_id));

create policy services_read on services
  for select using (active or is_business_member(business_id));
create policy services_member_insert on services
  for insert with check (is_business_member(business_id));
create policy services_member_update on services
  for update using (is_business_member(business_id)) with check (is_business_member(business_id));
create policy services_member_delete on services
  for delete using (is_business_member(business_id));

-- customers: רק הלקוחה עצמה. עסק רואה לקוחות דרך business_customers בלבד.
create policy customers_self_read on customers
  for select using (user_id = auth.uid());
create policy customers_self_update on customers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy business_customers_member_read on business_customers
  for select using (is_business_member(business_id));
create policy business_customers_member_update on business_customers
  for update using (is_business_member(business_id)) with check (is_business_member(business_id));

-- bookings: קריאה בלבד. כל כתיבה דרך ה-RPCs למעלה.
create policy bookings_member_read on bookings
  for select using (is_business_member(business_id));
create policy bookings_customer_read on bookings
  for select using (customer_id = current_customer_id());

create policy booking_services_read on booking_services
  for select using (exists (select 1 from bookings b where b.id = booking_id));

create policy audit_member_read on audit_log
  for select using (is_business_member(business_id));

-- ---------- Column privileges ----------
-- RLS מגביל שורות; כאן מגבילים עמודות שאסור למשתמש לשנות (סטטוס/אימות/זהות).

revoke update on businesses from anon, authenticated;
grant update (name, phone, description, instagram_url,
              address_mode, city, neighborhood, street_public, approx_lat, approx_lng,
              booking_horizon_days, min_notice_minutes, buffer_minutes, cancel_window_hours,
              require_approval_all, require_approval_new, min_reliability_pct, approval_timeout_minutes)
  on businesses to authenticated;

revoke update on customers from anon, authenticated;
grant update (name, alt_preference) on customers to authenticated;

revoke update on business_customers from anon, authenticated;
grant update (name, notes) on business_customers to authenticated;

-- פונקציות פנימיות — לא נחשפות ל-API
revoke execute on function reliability_stats(uuid) from public, anon, authenticated;
revoke execute on function approval_deadline(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function expire_pending_bookings() from public, anon, authenticated;
revoke execute on function services_duration(uuid, uuid[]) from public, anon, authenticated;

-- ---------- Seed: קטלוג קטגוריות (החלטה 5) ----------

insert into category_groups (key, name, sort_order) values
  ('nails',     'ציפורניים',       1),
  ('hair',      'שיער',            2),
  ('makeup',    'איפור',           3),
  ('brows',     'גבות וריסים',     4),
  ('cosmetics', 'קוסמטיקה וטיפוח', 5),
  ('fitness',   'אימון אישי',      6);

insert into categories (group_key, name, sort_order) values
  ('nails', 'לק ג''ל',                 1),
  ('nails', 'מילוי ג''ל',              2),
  ('nails', 'בניית ציפורניים',         3),
  ('nails', 'הסרת ג''ל',               4),
  ('nails', 'מניקור',                  5),
  ('nails', 'פדיקור',                  6),
  ('nails', 'פדיקור רפואי',            7),
  ('nails', 'עיצוב ציפורניים',         8),
  ('hair',  'תספורת נשים',             1),
  ('hair',  'תספורת גברים',            2),
  ('hair',  'תספורת ילדים',            3),
  ('hair',  'פן',                      4),
  ('hair',  'צבע שורש',                5),
  ('hair',  'צבע מלא',                 6),
  ('hair',  'גוונים / בלונד',          7),
  ('hair',  'החלקה',                   8),
  ('hair',  'טיפול שיקום לשיער',       9),
  ('hair',  'תסרוקת ערב / כלה',        10),
  ('hair',  'תוספות שיער',             11),
  ('makeup', 'איפור ערב',              1),
  ('makeup', 'איפור כלה',              2),
  ('makeup', 'איפור קבוע',             3),
  ('makeup', 'שיעור איפור אישי',       4),
  ('brows', 'עיצוב גבות',              1),
  ('brows', 'מיקרובליידינג',           2),
  ('brows', 'הרמת ריסים',              3),
  ('brows', 'הארכת ריסים',             4),
  ('cosmetics', 'טיפול פנים',          1),
  ('cosmetics', 'ניקוי עור',           2),
  ('cosmetics', 'פילינג',              3),
  ('cosmetics', 'הסרת שיער בשעווה',    4),
  ('cosmetics', 'הסרת שיער בלייזר',    5),
  ('fitness', 'אימון אישי',            1),
  ('fitness', 'אימון זוגי',            2),
  ('fitness', 'פילאטיס מכשירים',       3),
  ('fitness', 'אימון אונליין',         4);
