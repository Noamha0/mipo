-- ============================================================
-- 0005 — זהות, הסכמה לשיווק וחסימות
-- * מייל כשדה רשות ללקוחה (הטלפון המאומת נשאר המזהה).
-- * הסכמה לדיוור שיווקי לפי ערוץ, כיומן שמור (מי, מתי, מאיזה מסך) —
--   חוק התקשורת סעיף 30א: הסכמה מפורשת, נפרדת, וניתנת לביטול.
-- * חסימה ברמת עסק (עסק חוסם לקוחה אצלו בלבד) וחסימה ברמת המערכת (אדמין).
--   האכיפה בשרת, ב-create_booking.
-- בטוח להרצה חוזרת.
-- ============================================================

-- ---------- לקוחה: מייל וחסימה מערכתית ----------

alter table customers add column if not exists email text;
alter table customers add column if not exists blocked_at timestamptz;
alter table customers add column if not exists blocked_reason text;
alter table customers add column if not exists blocked_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_email_check') then
    alter table customers add constraint customers_email_check
      check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
end;
$$;

-- הלקוחה מעדכנת את המייל של עצמה; את החסימה לא
grant update (email) on customers to authenticated;

-- ---------- אדמינים של המערכת ----------

create table if not exists platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table platform_admins enable row level security;
-- אין policies: הטבלה לא נגישה דרך ה-API. מוסיפים אדמין רק דרך SQL Editor / service role.

create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- חסימה / שחרור של לקוחה בכל המערכת, לפי טלפון (גם אם פתחה חשבון מחדש — הטלפון זהה)
create or replace function admin_set_customer_block(p_phone text, p_blocked boolean, p_reason text default null)
returns customers language plpgsql volatile security definer set search_path = public as $$
declare
  c customers%rowtype;
begin
  if not is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  update customers
     set blocked_at = case when p_blocked then now() end,
         blocked_reason = case when p_blocked then nullif(trim(p_reason), '') end,
         blocked_by = case when p_blocked then auth.uid() end
   where phone = normalize_il_phone(p_phone)
  returning * into c;
  if not found then
    raise exception 'customer_not_found';
  end if;
  return c;
end;
$$;

-- ---------- הסכמה לשיווק ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'marketing_channel') then
    create type marketing_channel as enum ('sms', 'whatsapp', 'email');
  end if;
end;
$$;

-- יומן בלבד (לא מעדכנים ולא מוחקים): המצב הנוכחי = הרשומה האחרונה לכל ערוץ
create table if not exists marketing_consents (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  channel      marketing_channel not null,
  granted      boolean not null,
  source       text not null,      -- איזה מסך: profile, booking ...
  created_at   timestamptz not null default now()
);
create index if not exists idx_consents_customer on marketing_consents (customer_id, channel, created_at desc);
alter table marketing_consents enable row level security;

drop policy if exists consents_self_read on marketing_consents;
create policy consents_self_read on marketing_consents
  for select using (customer_id = current_customer_id());

create or replace function set_marketing_consent(p_channel marketing_channel, p_granted boolean, p_source text default 'profile')
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  cid uuid := claim_customer(null);
begin
  if p_channel = 'email' and p_granted
     and (select email from customers where id = cid) is null then
    raise exception 'email_required';
  end if;
  insert into marketing_consents (customer_id, channel, granted, source)
  values (cid, p_channel, p_granted, left(coalesce(p_source, 'profile'), 40));
end;
$$;

-- המצב הנוכחי של הלקוחה המחוברת, ערוץ לכל שורה
create or replace function my_marketing_consents()
returns table (channel marketing_channel, granted boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (mc.channel) mc.channel, mc.granted, mc.created_at
  from marketing_consents mc
  where mc.customer_id = current_customer_id()
  order by mc.channel, mc.created_at desc;
$$;

-- ---------- חסימה ברמת עסק ----------

create table if not exists business_blocked_customers (
  business_id  uuid not null references businesses(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  reason       text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (business_id, customer_id)
);
alter table business_blocked_customers enable row level security;

drop policy if exists blocked_member_read on business_blocked_customers;
create policy blocked_member_read on business_blocked_customers
  for select using (is_business_member(business_id));
-- הוספה והסרה רק דרך הפונקציות (בדיקת הרשאה + תיעוד ביומן)

create or replace function set_business_block(p_business_id uuid, p_customer_id uuid, p_blocked boolean, p_reason text default null)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_business_member(p_business_id)
     or not exists (select 1 from business_customers where business_id = p_business_id and customer_id = p_customer_id) then
    raise exception 'not_allowed';
  end if;

  if p_blocked then
    insert into business_blocked_customers (business_id, customer_id, reason, created_by)
    values (p_business_id, p_customer_id, nullif(trim(p_reason), ''), auth.uid())
    on conflict (business_id, customer_id) do update set reason = excluded.reason;
  else
    delete from business_blocked_customers where business_id = p_business_id and customer_id = p_customer_id;
  end if;

  insert into audit_log (business_id, actor, action, data)
  values (p_business_id, auth.uid(), case when p_blocked then 'customer_blocked' else 'customer_unblocked' end,
          jsonb_build_object('customer_id', p_customer_id, 'reason', nullif(trim(p_reason), '')));
  return p_blocked;
end;
$$;

-- ---------- אכיפה: create_booking בודק חסימות ----------
-- עטיפה על המימוש של 0001: בודקים לפני ההזמנה, ואז מעבירים הלאה.
-- (קליטה ידנית של העסק לא נחסמת — העסק עצמו מחליט לקבוע.)

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'create_booking_unchecked') then
    alter function create_booking(uuid, uuid[], timestamptz, text, alt_preference, booking_source)
      rename to create_booking_unchecked;
    revoke execute on function create_booking_unchecked(uuid, uuid[], timestamptz, text, alt_preference, booking_source)
      from public, anon, authenticated;
  end if;
end;
$$;

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

-- ---------- היומן מראה לעסק מי חסומה אצלו ----------
-- שינוי עמודות בפלט מחייב drop + create

drop function if exists business_calendar(uuid, timestamptz, timestamptz);
create function business_calendar(p_business_id uuid, p_from timestamptz, p_to timestamptz)
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
  visits                 int,
  attended               int,
  no_shows               int,
  late_cancels           int,
  score                  int,
  blocked_here           boolean,  -- חסומה אצל העסק הזה
  block_reason           text
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
         r.attended, r.no_shows, r.late_cancels, r.score,
         bb.customer_id is not null, bb.reason
  from bookings bk
  join customers c on c.id = bk.customer_id
  left join business_customers bc on bc.business_id = bk.business_id and bc.customer_id = bk.customer_id
  left join business_blocked_customers bb on bb.business_id = bk.business_id and bb.customer_id = bk.customer_id
  cross join lateral reliability_stats(bk.customer_id) r
  where bk.business_id = p_business_id
    and bk.starts_at < p_to and bk.ends_at > p_from
  order by bk.starts_at;
end;
$$;

-- ---------- הרשאות ----------

revoke execute on function business_calendar(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function business_calendar(uuid, timestamptz, timestamptz) to authenticated;
revoke execute on function admin_set_customer_block(text, boolean, text) from public, anon;
grant execute on function admin_set_customer_block(text, boolean, text) to authenticated;
revoke execute on function set_marketing_consent(marketing_channel, boolean, text) from public, anon;
grant execute on function set_marketing_consent(marketing_channel, boolean, text) to authenticated;
revoke execute on function my_marketing_consents() from public, anon;
grant execute on function my_marketing_consents() to authenticated;
revoke execute on function set_business_block(uuid, uuid, boolean, text) from public, anon;
grant execute on function set_business_block(uuid, uuid, boolean, text) to authenticated;
