-- ============================================================
-- נתוני דמה עשירים לתור-לי: ~14 עסקים עם תמונות, מיקומים, דירוגים.
-- מוסיף שדות תצוגה (image_url/rating/review_count) ומאכלס קטלוג + שעות + שירותים.
-- בטוח להרצה חוזרת. דורש שהמיגרציה 0001 כבר הורצה.
-- ============================================================
alter table businesses add column if not exists image_url    text;
alter table businesses add column if not exists rating       numeric(2,1);
alter table businesses add column if not exists review_count int;

-- העסק הקיים (demo) — להשלים לו תמונה ודירוג
update businesses
   set image_url = 'https://picsum.photos/seed/torli-demo/800/500',
       rating = 4.8, review_count = 96
 where slug = 'demo';

do $$
declare
  r record;
  bid uuid;
  cal uuid;
  svc text;
  ord int;
  dur int;
  prc numeric;
begin
  delete from businesses where slug like 'demo-%';

  for r in
    select * from (values
      ('demo-nails-tlv','ציפורני לורן','תל אביב','פלורנטין','studio','סטודיו ציפורניים בוטיק בלב פלורנטין.','nails-tlv',4.9,212,array['לק ג''ל','מניקור','בניית ציפורניים']),
      ('demo-hair-haifa','סלון רונן שיער','חיפה','הדר','studio','עיצוב שיער, צבע והחלקות בידיים מקצועיות.','hair-haifa',4.7,180,array['תספורת נשים','צבע מלא','פן']),
      ('demo-makeup-tlv','סטודיו מייקאפ בר','תל אביב','רוטשילד','studio','איפור ערב, כלות וסדנאות אישיות.','makeup-tlv',5.0,310,array['איפור ערב','איפור כלה','שיעור איפור אישי']),
      ('demo-brows-ptk','גבות מושלמות','פתח תקווה','מרכז העיר','studio','עיצוב גבות, מיקרובליידינג והרמת ריסים.','brows-ptk',4.8,142,array['עיצוב גבות','מיקרובליידינג','הרמת ריסים']),
      ('demo-spa-jlm','ספא רחביה','ירושלים','רחביה','studio','טיפולי פנים וניקוי עור ברוגע מושלם.','spa-jlm',4.6,88,array['טיפול פנים','ניקוי עור','פילינג']),
      ('demo-nails-rg','ננה ניילס','רמת גן','מרכז','home','ציפורניים מהבית, יחס אישי וחם.','nails-rg',4.9,167,array['לק ג''ל','פדיקור','עיצוב ציפורניים']),
      ('demo-hair-bs','שיער של נעמה','באר שבע','ד','studio','תספורות, פן וטיפולי שיקום לשיער.','hair-bs',4.5,74,array['תספורת נשים','פן','טיפול שיקום לשיער']),
      ('demo-fitness-tlv','אימון עם דן','תל אביב','הצפון הישן','studio','אימון אישי וזוגי מותאם אישית.','fitness-tlv',5.0,251,array['אימון אישי','אימון זוגי','פילאטיס מכשירים']),
      ('demo-lashes-netanya','ריסים של רוני','נתניה','עיר ימים','home','הארכת והרמת ריסים בסטנדרט גבוה.','lashes-net',4.8,133,array['הארכת ריסים','הרמת ריסים']),
      ('demo-cosmetics-afula','עור בריא עפולה','עפולה','מרכז','studio','קוסמטיקה רפואית, פילינג והסרת שיער.','cosm-afula',4.7,59,array['טיפול פנים','הסרת שיער בשעווה','פילינג']),
      ('demo-hair-rishon','סלון ליאת','ראשון לציון','רמת אליהו','studio','צבע, גוונים והחלקות מקצועיות.','hair-rishon',4.6,121,array['צבע מלא','גוונים / בלונד','החלקה']),
      ('demo-nails-herzliya','לק אנד גו','הרצליה','הרצליה פיתוח','studio','מניקור ולק ג''ל מהיר ואיכותי.','nails-herz',4.8,198,array['לק ג''ל','מניקור','הסרת ג''ל']),
      ('demo-makeup-haifa','איפור בר חיפה','חיפה','כרמל','home','איפור ערב וכלות עד הבית.','makeup-haifa',4.9,176,array['איפור ערב','איפור כלה']),
      ('demo-barber-tlv','ברברשופ נורת''','תל אביב','נווה צדק','studio','תספורות גברים וטיפוח זקן.','barber-tlv',4.7,204,array['תספורת גברים','תספורת ילדים'])
    ) as t(slug,name,city,neighborhood,mode,descr,imgseed,rating,reviews,cats)
  loop
    insert into businesses (slug,name,city,neighborhood,address_mode,description,image_url,rating,review_count,status,phone)
    values (r.slug,r.name,r.city,r.neighborhood,r.mode::address_mode,r.descr,
            'https://picsum.photos/seed/'||r.imgseed||'/800/500',
            r.rating,r.reviews,'listed','0501234567')
    returning id into bid;

    insert into business_private (business_id) values (bid);
    insert into calendars (business_id) values (bid) returning id into cal;

    insert into open_hours (business_id,calendar_id,weekday,opens,closes)
      select bid,cal,wd,time '09:00',time '19:00' from generate_series(0,4) wd
      union all select bid,cal,5,time '08:00',time '13:00';

    ord := 0;
    foreach svc in array r.cats loop
      dur := (array[20,30,45,60,90])[1+floor(random()*5)::int];
      prc := (6 + floor(random()*25))*10;
      insert into services (business_id,category_id,name,price,duration_min,active,sort_order)
      select bid, c.id, svc, prc, dur, true, ord
      from categories c where c.name = svc;
      ord := ord + 1;
    end loop;
  end loop;
end $$;

select count(*) || ' עסקים מופיעים בחיפוש' as done from businesses where status='listed';
