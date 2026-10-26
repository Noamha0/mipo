-- ============================================================
-- נתוני דמה ל-MIPO: 10 עסקים בעפולה, אחד או שניים לכל תחום.
-- כל העסקים מסומנים בבירור כדמה (slug מתחיל ב-mipo-demo-).
-- דורש את המיגרציות 0001 ו-0002. בטוח להרצה חוזרת (מוחק ויוצר מחדש).
-- הסרה מלאה: delete from businesses where slug like 'mipo-demo-%';
-- ============================================================
do $$
declare
  r record;
  s jsonb;
  bid uuid;
  cal uuid;
  ord int;
begin
  delete from businesses where slug like 'mipo-demo-%';

  for r in
    select * from (values
      ('mipo-demo-nails',    'ציפורני מאיה (דמו)',         'גבעת המורה', 'home',   'nails-maya',   4.9, 126, '[{"c":"לק ג''ל","d":60,"p":120},{"c":"בניית ציפורניים","d":90,"p":180},{"c":"פדיקור רפואי","d":60,"p":140}]'),
      ('mipo-demo-barber',   'ברבר עפולה (דמו)',            'מרכז',       'studio', 'barber-afula', 4.7, 88,  '[{"c":"תספורת גברים","d":30,"p":70},{"c":"תספורת ילדים","d":30,"p":55}]'),
      ('mipo-demo-yoga',     'סטודיו נשימה (דמו)',          'עפולה עילית','studio', 'yoga-afula',   4.9, 64,  '[{"c":"יוגה","d":60,"p":80},{"c":"פילאטיס מכשירים","d":60,"p":110}]'),
      ('mipo-demo-massage',  'מגע של שקט (דמו)',            'מרכז',       'studio', 'massage-af',   4.8, 64,  '[{"c":"עיסוי שוודי","d":60,"p":200},{"c":"רפלקסולוגיה","d":45,"p":160}]'),
      ('mipo-demo-clean',    'ניקיון נוצץ (דמו)',           'גבעת המורה', 'home',   'clean-afula',  4.6, 41,  '[{"c":"ניקיון בית","d":180,"p":360},{"c":"ניקיון ספות ושטיחים","d":90,"p":250}]'),
      ('mipo-demo-plumber',  'אינסטלציה מהירה (דמו)',       'אזור תעשייה','studio', 'plumber-af',   4.7, 52,  '[{"c":"אינסטלטור","d":60,"p":250}]'),
      ('mipo-demo-electric', 'חשמל בטוח (דמו)',             'מרכז',       'studio', 'electric-af',  4.8, 37,  '[{"c":"חשמלאי","d":60,"p":280},{"c":"הנדימן","d":120,"p":300}]'),
      ('mipo-demo-dogwalk',  'הולכים עם רוני (דמו)',        'עפולה עילית','home',   'dogwalk-af',   4.7, 52,  '[{"c":"דוגווקר","d":45,"p":70},{"c":"אילוף כלבים","d":60,"p":180}]'),
      ('mipo-demo-groom',    'מספרת הכלבים של שני (דמו)',   'מרכז',       'studio', 'groom-af',     4.9, 73,  '[{"c":"מספרת כלבים","d":90,"p":200}]'),
      ('mipo-demo-tutor',    'מתמטיקה בכיף (דמו)',          'גבעת המורה', 'home',   'tutor-af',     5.0, 29,  '[{"c":"מורה פרטי","d":60,"p":150}]')
    ) as t(slug, name, neighborhood, mode, imgseed, rating, reviews, svcs)
  loop
    insert into businesses (slug, name, city, neighborhood, address_mode, description,
                            image_url, rating, review_count, status, phone)
    values (r.slug, r.name, 'עפולה', r.neighborhood, r.mode::address_mode,
            'עסק לדוגמה ב-MIPO — לבדיקת החיפוש והזמנת התורים.',
            'https://picsum.photos/seed/mipo-' || r.imgseed || '/800/500',
            r.rating, r.reviews, 'listed', '972500000000')
    returning id into bid;

    insert into business_private (business_id) values (bid);
    insert into calendars (business_id) values (bid) returning id into cal;

    -- א'–ה' 08:00–20:00, ו' 08:00–14:00
    insert into open_hours (business_id, calendar_id, weekday, opens, closes)
    select bid, cal, wd, time '08:00', time '20:00' from generate_series(0, 4) wd
    union all
    select bid, cal, 5, time '08:00', time '14:00';

    ord := 0;
    for s in select * from jsonb_array_elements(r.svcs::jsonb) loop
      insert into services (business_id, category_id, name, duration_min, price, sort_order)
      select bid, c.id, s->>'c', (s->>'d')::int, (s->>'p')::numeric, ord
      from categories c where c.name = s->>'c';
      ord := ord + 1;
    end loop;
  end loop;
end $$;

select count(*) || ' עסקי דמה של MIPO בעפולה' as done from businesses where slug like 'mipo-demo-%';
