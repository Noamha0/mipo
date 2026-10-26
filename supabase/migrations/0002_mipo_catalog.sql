-- ============================================================
-- 0002 — MIPO: הרחבת הקטלוג מיופי וטיפוח לכל השירותים המקומיים,
-- ושדות התצוגה של כרטיס עסק (תמונה, דירוג).
-- בטוח להרצה חוזרת: כל ההוספות הן if not exists / on conflict do nothing.
--
-- הערה: שירותים שמגיעים לבית הלקוח (אינסטלטור, ניקיון, דוגווקר) עובדים כאן
-- כמו כל עסק — משבצת זמן ביומן. חישוב זמני נסיעה בין לקוחות נשאר ל-v2 (החלטה 15).
-- ============================================================

-- שדות תצוגה: עד עכשיו נוספו רק דרך seed הדמו — כאן הם הופכים לחלק מהסכימה
alter table businesses add column if not exists image_url    text;
alter table businesses add column if not exists rating       numeric(2,1) check (rating between 0 and 5);
alter table businesses add column if not exists review_count int check (review_count >= 0);

-- בעל/ת העסק מעלה תמונה משלו (הדירוג יחושב מביקורות ב-v1.5 — לא ניתן לעריכה)
grant update (image_url) on businesses to authenticated;

insert into category_groups (key, name, sort_order) values
  ('wellness', 'בריאות וגוף',       7),
  ('home',     'שירותי בית',         8),
  ('pros',     'בעלי מקצוע',         9),
  ('pets',     'חיות מחמד',          10),
  ('family',   'ילדים ולימודים',     11)
on conflict (key) do nothing;

insert into categories (group_key, name, sort_order) values
  ('fitness',  'יוגה',                   5),
  ('wellness', 'עיסוי שוודי',            1),
  ('wellness', 'עיסוי רקמות עמוקות',     2),
  ('wellness', 'רפלקסולוגיה',            3),
  ('wellness', 'פיזיותרפיה',             4),
  ('home',     'ניקיון בית',             1),
  ('home',     'ניקיון ספות ושטיחים',    2),
  ('home',     'הדברה',                  3),
  ('home',     'גינון',                  4),
  ('pros',     'אינסטלטור',              1),
  ('pros',     'חשמלאי',                 2),
  ('pros',     'הנדימן',                 3),
  ('pros',     'טכנאי מזגנים',           4),
  ('pros',     'מנעולן',                 5),
  ('pets',     'דוגווקר',                1),
  ('pets',     'מספרת כלבים',            2),
  ('pets',     'אילוף כלבים',            3),
  ('family',   'בייביסיטר',              1),
  ('family',   'מורה פרטי',              2),
  ('family',   'שיעור נגינה',            3)
on conflict (name) do nothing;
