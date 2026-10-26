-- ============================================================
-- נתוני דמה לצד הלקוח: עסק הדגמה עם slug = 'demo'
-- הרץ ב-Supabase SQL Editor של הפרויקט שהאפליקציה מחוברת אליו.
-- בטוח להרצה חוזרת (מוחק קודם את עסק הדמה הקיים).
-- דורש שהמיגרציה 0001_foundation.sql כבר הורצה בפרויקט.
-- אחרי ההרצה: פתח /b/demo באפליקציה.
-- ============================================================
do $$
declare
  bid uuid;
  cal uuid;
begin
  delete from businesses where slug = 'demo';  -- cascade מנקה שירותים/שעות/יומן

  insert into businesses (slug, name, phone, description, status,
                          address_mode, city, neighborhood, street_public)
  values ('demo', 'סטודיו דמו', '0501234567',
          'עסק הדגמה לבדיקת צד הלקוח — ציפורניים, גבות ואיפור.',
          'listed', 'studio', 'עפולה', 'מרכז', 'רחוב הדגמה 1')
  returning id into bid;

  insert into business_private (business_id, street, house_number) values (bid, 'רחוב הדגמה', '1');
  insert into calendars (business_id) values (bid) returning id into cal;

  -- א'–ה' 09:00–19:00, ו' 08:00–13:00
  insert into open_hours (business_id, calendar_id, weekday, opens, closes)
  select bid, cal, wd, time '09:00', time '19:00' from generate_series(0, 4) wd
  union all
  select bid, cal, 5, time '08:00', time '13:00';

  -- שירותים מתוך קטלוג הקטגוריות הקיים
  insert into services (business_id, category_id, name, price, duration_min, sort_order)
  select bid, c.id, v.cat, v.price, v.dur, v.ord
  from (values
    ('לק ג''ל',     120::numeric, 45, 0),
    ('מניקור',       90,          30, 1),
    ('עיצוב גבות',   60,          20, 2),
    ('איפור ערב',   250,          60, 3)
  ) as v(cat, price, dur, ord)
  join categories c on c.name = v.cat;
end $$;

select 'עסק דמה נוצר — פתח /b/demo' as done;
