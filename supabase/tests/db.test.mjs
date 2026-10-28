// ============================================================
// בדיקות אבן דרך 1: סכימה, RLS, מנוע משבצות ופעולות התור.
// רץ מקומית על PGlite (Postgres ב-WASM) — בלי Docker ובלי פרויקט
// Supabase. supabase_stub.sql מדמה את auth ואת התפקידים.
// הרצה: npm run test:db
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const here = new URL('.', import.meta.url);
const migrationsDir = new URL('../migrations/', here);

const db = await PGlite.create({ extensions: { btree_gist } });
await db.exec(readFileSync(new URL('supabase_stub.sql', here), 'utf8'));
for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(f, migrationsDir), 'utf8'));
}

const U = {
  ownerA: '00000000-0000-0000-0000-00000000000a',
  ownerB: '00000000-0000-0000-0000-00000000000b',
  custC: '00000000-0000-0000-0000-00000000000c',
  custD: '00000000-0000-0000-0000-00000000000d',
  custE: '00000000-0000-0000-0000-00000000000e',
};

// כסופר-יוזר (כמו service role / pg_cron)
const su = async (sql, params = []) => (await db.query(sql, params)).rows;

// כמשתמש מחובר (uid) או אנונימי (null) — RLS והרשאות פעילים
async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid }) : '']);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

const fails = (promise, fragment) =>
  assert.rejects(promise, (e) => {
    assert.match(e.message, new RegExp(fragment));
    return true;
  });

// שעון קיר בירושלים: היום + dayOffset בשעה hhmm
async function at(dayOffset, hhmm) {
  const [{ t }] = await su(
    `select (((now() at time zone 'Asia/Jerusalem')::date + $1::int) + $2::time) at time zone 'Asia/Jerusalem' as t`,
    [dayOffset, hhmm],
  );
  return t;
}

const slots = async (uid, businessId, serviceIds, dayOffset, days = 1) =>
  (
    await as(
      uid,
      `select slot_start from available_slots($1, $2::uuid[], ((now() at time zone 'Asia/Jerusalem')::date + $3::int), $4)`,
      [businessId, serviceIds, dayOffset, days],
    )
  ).map((r) => r.slot_start.getTime());

const book = async (uid, businessId, serviceIds, start, name = null) =>
  (await as(uid, `select * from create_booking($1, $2::uuid[], $3, $4)`, [businessId, serviceIds, start, name]))[0];

// ---------- Fixtures ----------

await su(`insert into auth.users (id, phone) values
  ($1, '972500000001'), ($2, '972500000002'), ($3, '972540000003'), ($4, '972540000004'), ($5, '972529999999')`,
  [U.ownerA, U.ownerB, U.custC, U.custD, U.custE]);

const [{ create_business: bizA }] = await as(U.ownerA, `select create_business('nails-a', 'הציפורניים של א')`);
const [{ create_business: bizB }] = await as(U.ownerB, `select create_business('hair-b', 'מספרת ב')`);

// עסק א פתוח כל יום 08:00–20:00 (עריכת שעות דרך RLS של בעלת העסק)
await as(U.ownerA, `delete from open_hours where business_id = $1`, [bizA]);
await as(U.ownerA, `insert into open_hours (business_id, calendar_id, weekday, opens, closes)
  select $1, (select id from calendars where business_id = $1), wd, '08:00', '20:00' from generate_series(0, 6) wd`, [bizA]);

const cat = async (name) => (await su(`select id from categories where name = $1`, [name]))[0].id;
const [{ id: gel }] = await as(U.ownerA,
  `insert into services (business_id, category_id, name, price, duration_min) values ($1, $2, 'לק ג''ל רוסי', 120, 60) returning id`,
  [bizA, await cat("לק ג'ל")]);
const [{ id: pedi }] = await as(U.ownerA,
  `insert into services (business_id, category_id, name, price, duration_min) values ($1, $2, 'פדיקור', 100, 45) returning id`,
  [bizA, await cat('פדיקור')]);
const [{ id: haircut }] = await as(U.ownerB,
  `insert into services (business_id, category_id, name, price, duration_min) values ($1, $2, 'תספורת', 90, 45) returning id`,
  [bizB, await cat('תספורת נשים')]);

const D2 = 2; // יום הבדיקות העיקרי — מחרתיים
let bookingC10; // התור של C ב-10:00

// ---------- Tests ----------

test('catalog seeded (0001 beauty + 0002 MIPO sectors)', async () => {
  const [{ n }] = await as(null, `select count(*)::int n from categories`);
  assert.equal(n, 56);
  const [{ g }] = await as(null, `select count(*)::int g from category_groups`);
  assert.equal(g, 11);
  // כל קטגוריה שייכת לקבוצה קיימת, וכל קבוצה חדשה קיבלה קטגוריות
  const empty = await as(null, `select key from category_groups cg where not exists (select 1 from categories c where c.group_key = cg.key)`);
  assert.deepEqual(empty, []);
});

test('0002 is safe to re-run', async () => {
  await db.exec(readFileSync(new URL('../migrations/0002_mipo_catalog.sql', here), 'utf8'));
  const [{ n }] = await su(`select count(*)::int n from categories`);
  assert.equal(n, 56);
});

test('anon sees public profile but nothing private', async () => {
  assert.equal((await as(null, `select id from businesses`)).length, 2);
  assert.equal((await as(null, `select id from services where business_id = $1`, [bizA])).length, 2);
  assert.equal((await as(null, `select id from open_hours where business_id = $1`, [bizA])).length, 7);
  assert.equal((await as(null, `select id from business_members`)).length, 0);
  await su(`insert into calendar_exceptions (business_id, calendar_id, kind, during, reason)
    select $1, id, 'block', tstzrange(now() + interval '30 days', now() + interval '31 days'), 'חופשה' from calendars where business_id = $1`, [bizA]);
  assert.equal((await as(null, `select id from calendar_exceptions`)).length, 0);
  assert.equal((await as(U.ownerA, `select id from calendar_exceptions`)).length, 1);
});

test('slot grid: 15-minute steps inside opening hours', async () => {
  const s = await slots(null, bizA, [gel], D2);
  assert.equal(s.length, 45); // 08:00 … 19:00
  assert.equal(s[0], (await at(D2, '08:00')).getTime());
  assert.equal(s.at(-1), (await at(D2, '19:00')).getTime());

  const basket = await slots(null, bizA, [gel, pedi], D2); // 105 דקות
  assert.equal(basket.length, 42); // 08:00 … 18:15
  assert.equal(basket.at(-1), (await at(D2, '18:15')).getTime());
});

test('slots respect minimum notice and the booking horizon', async () => {
  const minStart = Date.now() + 120 * 60_000 - 5_000;
  for (const t of await slots(null, bizA, [gel], 0)) assert.ok(t >= minStart);
  assert.ok((await slots(null, bizA, [gel], 6)).length > 0);
  assert.equal((await slots(null, bizA, [gel], 7)).length, 0); // אופק 7 ימים: היום … היום+6
});

test('services from another business are rejected', async () => {
  await fails(slots(null, bizA, [haircut], D2), 'invalid_services');
});

test('customer books an open slot and is auto-confirmed', async () => {
  bookingC10 = await book(U.custC, bizA, [gel], await at(D2, '10:00'), 'שירה');
  assert.equal(bookingC10.status, 'confirmed');
  assert.equal(bookingC10.source, 'link');
  assert.equal(Number(bookingC10.total_price), 120);
  assert.equal(bookingC10.ends_at.getTime() - bookingC10.starts_at.getTime(), 60 * 60_000);

  const [me] = await as(U.custC, `select phone, name from customers`);
  assert.deepEqual(me, { phone: '972540000003', name: 'שירה' });
  const [bc] = await as(U.ownerA, `select name, phone from business_customers`);
  assert.deepEqual(bc, { name: 'שירה', phone: '972540000003' });
  assert.equal((await as(U.custC, `select * from booking_services where booking_id = $1`, [bookingC10.id])).length, 1);
});

test('no double booking — not via slots, not via a race, not via manual entry', async () => {
  await fails(book(U.custD, bizA, [gel], await at(D2, '10:00')), 'slot_unavailable');
  await fails(book(U.custD, bizA, [gel], await at(D2, '10:30')), 'slot_unavailable');
  // הזנה ידנית לא בודקת שעות — אבל ה-exclusion constraint עדיין חוסם חפיפה
  await fails(as(U.ownerA, `select * from create_manual_booking($1, '0520000000', 'x', $2::uuid[], $3)`,
    [bizA, [gel], await at(D2, '10:30')]), 'slot_unavailable');

  const s = await slots(null, bizA, [gel], D2);
  assert.equal(s.length, 45 - 7); // 09:15 … 10:45 תפוסים
  assert.ok(!s.includes((await at(D2, '09:15')).getTime()));
  assert.ok(s.includes((await at(D2, '09:00')).getTime()));
  assert.ok(s.includes((await at(D2, '11:00')).getTime()));
});

test('cleaning buffer is applied to new bookings', async () => {
  await as(U.ownerA, `update businesses set buffer_minutes = 15 where id = $1`, [bizA]);
  const s = await slots(null, bizA, [gel], D2);
  assert.ok(s.includes((await at(D2, '08:45')).getTime())); // 08:45–09:45 + 15 = נגמר בדיוק ב-10:00
  assert.ok(!s.includes((await at(D2, '09:00')).getTime()));
  await as(U.ownerA, `update businesses set buffer_minutes = 0 where id = $1`, [bizA]);
});

test('tenants and customers are isolated', async () => {
  assert.equal((await as(U.ownerB, `select id from bookings`)).length, 0);
  assert.equal((await as(U.ownerB, `select * from business_customers`)).length, 0);
  assert.equal((await as(U.custD, `select id from bookings`)).length, 0);
  assert.equal((await as(U.custD, `select id from customers`)).length, 0);
  assert.equal((await as(null, `select id from customers`)).length, 0);
  await fails(as(U.ownerB, `select * from customer_reliability($1, $2)`, [bookingC10.customer_id, bizB]), 'not_allowed');
  await fails(as(U.ownerB, `select * from decide_booking($1, true)`, [bookingC10.id]), 'not_allowed');
});

test('users cannot bypass the RPCs or change protected columns', async () => {
  await fails(as(U.ownerA, `update businesses set status = 'listed' where id = $1`, [bizA]), 'permission denied');
  await fails(as(U.custC, `update customers set phone = '972500000009'`), 'permission denied');
  await fails(as(U.custC, `insert into bookings (business_id, calendar_id, customer_id, starts_at, ends_at, occupied, status, source)
    values ($1, (select id from calendars where business_id = $1), $2, now() + interval '3 days', now() + interval '3 days 1 hour',
            tstzrange(now() + interval '3 days', now() + interval '3 days 1 hour'), 'confirmed', 'link')`,
    [bizA, bookingC10.customer_id]), 'row-level security');
  // עדכון שבוצע ע"י הלקוחה על התור שלה נחסם (אין policy לעדכון)
  const rows = await as(U.custC, `update bookings set status = 'completed' where id = $1 returning id`, [bookingC10.id]);
  assert.equal(rows.length, 0);
  await fails(as(U.ownerA, `select expire_pending_bookings()`), 'permission denied');
  await fails(as(U.ownerA, `select * from reliability_stats($1)`, [bookingC10.customer_id]), 'permission denied');
  // מה שמותר — עובד
  await as(U.ownerA, `update businesses set description = 'סטודיו קטן ונעים' where id = $1`, [bizA]);
  await as(U.custC, `update customers set alt_preference = 'same_business'`);
});

test('approval flow: new customers wait; the slot is held, then freed on reject', async () => {
  await as(U.ownerA, `update businesses set require_approval_new = true where id = $1`, [bizA]);
  const start = await at(D2, '12:00');
  const bk = await book(U.custD, bizA, [gel], start, 'דנה');
  assert.equal(bk.status, 'pending');
  assert.ok(bk.approval_deadline.getTime() >= Date.now() + 14 * 60_000);
  assert.ok(bk.approval_deadline.getTime() <= start.getTime() - 60 * 60_000);

  assert.ok(!(await slots(null, bizA, [gel], D2)).includes(start.getTime())); // חסום בזמן ההמתנה
  await fails(book(U.custC, bizA, [gel], start), 'slot_unavailable');

  const rejected = (await as(U.ownerA, `select * from decide_booking($1, false)`, [bk.id]))[0];
  assert.equal(rejected.status, 'rejected');
  assert.ok((await slots(null, bizA, [gel], D2)).includes(start.getTime())); // שוחרר
  await fails(as(U.ownerA, `select * from decide_booking($1, true)`, [bk.id]), 'not_pending');
});

test('unanswered requests expire and release the slot', async () => {
  const start = await at(D2, '13:00');
  const bk = await book(U.custD, bizA, [gel], start);
  assert.equal(bk.status, 'pending');
  await su(`update bookings set approval_deadline = now() - interval '1 minute' where id = $1`, [bk.id]);
  await fails(as(U.ownerA, `select * from decide_booking($1, true)`, [bk.id]), 'approval_expired');

  const [{ expire_pending_bookings: n }] = await su(`select expire_pending_bookings()`);
  assert.equal(n, 1);
  assert.equal((await su(`select status from bookings where id = $1`, [bk.id]))[0].status, 'expired');
  assert.ok((await slots(null, bizA, [gel], D2)).includes(start.getTime()));
});

test('customer cancellation inside the window is late; others cannot cancel it', async () => {
  const bk = await book(U.custC, bizA, [gel], await at(D2, '15:00'));
  assert.equal(bk.status, 'pending'); // ל-C עדיין אין תור שהושלם
  await as(U.ownerA, `select * from decide_booking($1, true)`, [bk.id]);

  await fails(as(U.custD, `select * from cancel_booking($1)`, [bk.id]), 'not_allowed');
  await as(U.ownerA, `update businesses set cancel_window_hours = 72 where id = $1`, [bizA]);
  const c = (await as(U.custC, `select * from cancel_booking($1)`, [bk.id]))[0];
  assert.equal(c.status, 'cancelled_by_customer');
  assert.equal(c.late_cancel, true);
  await as(U.ownerA, `update businesses set cancel_window_hours = 24 where id = $1`, [bizA]);
});

test('attendance, dispute and reliability score', async () => {
  await fails(as(U.ownerA, `select * from mark_attendance($1, false)`, [bookingC10.id]), 'not_markable'); // עוד לא התחיל

  // מזיזים את התור של C לעבר
  await su(`update bookings set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour',
            occupied = tstzrange(now() - interval '2 hours', now() - interval '1 hour') where id = $1`, [bookingC10.id]);
  const cid = bookingC10.customer_id;
  const stats = async () => (await as(U.custC, `select * from customer_reliability($1)`, [cid]))[0];

  await as(U.ownerA, `select * from mark_attendance($1, false)`, [bookingC10.id]);
  assert.deepEqual(await stats(), { attended: 0, no_shows: 1, late_cancels: 1, score: 0 });

  await as(U.custC, `select * from dispute_no_show($1)`, [bookingC10.id]);
  assert.equal((await stats()).no_shows, 0); // בערעור — לא נספר
  await fails(as(U.custC, `select * from dispute_no_show($1)`, [bookingC10.id]), 'not_disputable');

  await as(U.ownerA, `select * from reaffirm_no_show($1)`, [bookingC10.id]);
  assert.equal((await stats()).no_shows, 1);

  await as(U.ownerA, `select * from mark_attendance($1, true)`, [bookingC10.id]); // תיקון: היא כן הגיעה
  assert.deepEqual(await stats(), { attended: 1, no_shows: 0, late_cancels: 1, score: 67 });

  // העסק רואה את הציון של לקוחה שקבעה אצלו
  assert.equal((await as(U.ownerA, `select * from customer_reliability($1, $2)`, [cid, bizA]))[0].score, 67);
  await fails(as(U.custD, `select * from customer_reliability($1)`, [cid]), 'not_allowed');

  // אחרי תור שהושלם היא כבר לא "חדשה" — מאושרת אוטומטית
  assert.equal((await book(U.custC, bizA, [gel], await at(D2, '16:00'))).status, 'confirmed');
});

test('low reliability requires approval; no history does not', async () => {
  await as(U.ownerA, `update businesses set require_approval_new = false, min_reliability_pct = 80 where id = $1`, [bizA]);
  assert.equal((await book(U.custC, bizA, [gel], await at(D2, '17:00'))).status, 'pending'); // 67 < 80
  assert.equal((await book(U.custD, bizA, [gel], await at(D2, '18:00'))).status, 'confirmed'); // אין היסטוריה
  await as(U.ownerA, `update businesses set min_reliability_pct = null where id = $1`, [bizA]);
});

test('manual entry links by phone and keeps the business label private', async () => {
  const cid = bookingC10.customer_id;
  const m = (await as(U.ownerA, `select * from create_manual_booking($1, '054-0000003', 'שירה מהוואטסאפ', $2::uuid[], $3)`,
    [bizA, [gel], await at(3, '10:00')]))[0];
  assert.equal(m.customer_id, cid);
  assert.equal(m.status, 'confirmed');
  assert.equal(m.source, 'manual');
  assert.equal((await as(U.ownerA, `select name from business_customers where customer_id = $1`, [cid]))[0].name, 'שירה מהוואטסאפ');
  assert.equal((await as(U.custC, `select name from customers`))[0].name, 'שירה');

  // טלפון חדש → לקוחה זמנית, שמשויכת כשנרשמת עם אותו טלפון
  const n = (await as(U.ownerA, `select * from create_manual_booking($1, '052-9999999', 'נועה', $2::uuid[], $3)`,
    [bizA, [gel], await at(3, '12:00')]))[0];
  assert.equal((await su(`select user_id from customers where id = $1`, [n.customer_id]))[0].user_id, null);
  const [{ claim_customer: claimed }] = await as(U.custE, `select claim_customer('נועה כהן')`);
  assert.equal(claimed, n.customer_id);
  assert.equal((await as(U.custE, `select id from bookings`)).length, 1);
});

test('home business address is revealed only after a confirmed booking', async () => {
  await as(U.ownerA, `update businesses set address_mode = 'home', neighborhood = 'גבעת המורה' where id = $1`, [bizA]);
  await as(U.ownerA, `update business_private set street = 'הנרקיסים', house_number = '12' where business_id = $1`, [bizA]);

  assert.equal((await as(null, `select street from business_private where business_id = $1`, [bizA])).length, 0);
  assert.equal((await as(U.ownerB, `select street from business_private where business_id = $1`, [bizA])).length, 0);
  assert.equal((await as(U.custD, `select street from business_private where business_id = $1`, [bizA]))[0].street, 'הנרקיסים');
  // לסטודיו הכתובת ציבורית
  assert.equal((await as(null, `select business_id from business_private where business_id = $1`, [bizB])).length, 1);
});

test('approval deadline counts business hours and respects the caps', async () => {
  const deadline = async (created, start) =>
    (await su(`select approval_deadline($1, $2, $3) d`, [bizA, created, start]))[0].d.getTime();
  // עסק א פתוח 08:00–20:00 כל יום, חלון 60 דקות
  assert.equal(await deadline(await at(0, '19:30'), await at(5, '10:00')), (await at(1, '08:30')).getTime()); // הזמנה בערב
  assert.equal(await deadline(await at(0, '03:00'), await at(5, '10:00')), (await at(0, '09:00')).getTime()); // הזמנה בלילה
  assert.equal(await deadline(await at(0, '12:00'), await at(0, '13:30')), (await at(0, '12:30')).getTime()); // שעה לפני התור
  assert.equal(await deadline(await at(0, '12:00'), await at(0, '12:40')), (await at(0, '12:15')).getTime()); // רצפה 15 דק'
});

test('business calendar: names, phones and reliability for the team only', async () => {
  const cal = (uid, from, to) => as(uid, `select * from business_calendar($1, $2, $3)`, [bizA, from, to]);
  const rows = await cal(U.ownerA, await at(3, '00:00'), await at(4, '00:00'));
  const shira = rows.find((r) => r.customer_name === 'שירה מהוואטסאפ');
  assert.equal(shira.customer_phone, '972540000003');
  assert.equal(shira.services, "לק ג'ל רוסי");
  assert.equal(shira.source, 'manual');
  assert.deepEqual([shira.visits, shira.attended, shira.late_cancels, shira.score], [1, 1, 1, 67]);
  assert.equal(rows.find((r) => r.customer_name === 'נועה').score, null); // אין היסטוריה

  await fails(cal(U.ownerB, await at(3, '00:00'), await at(4, '00:00')), 'not_allowed');
  await fails(cal(U.custC, await at(3, '00:00'), await at(4, '00:00')), 'not_allowed');
  await fails(cal(null, await at(3, '00:00'), await at(4, '00:00')), 'permission denied');
  await fails(cal(U.ownerA, await at(0, '00:00'), await at(70, '00:00')), 'invalid_range');

  // בקשה שעבר מועד האישור שלה מוצגת כפקועה, עוד לפני ה-cron
  const [{ id }] = await su(`select id from bookings where business_id = $1 and status = 'pending' limit 1`, [bizA]);
  await su(`update bookings set approval_deadline = now() - interval '1 minute' where id = $1`, [id]);
  const day = await cal(U.ownerA, await at(D2, '00:00'), await at(D2 + 1, '00:00'));
  assert.equal(day.find((r) => r.id === id).status, 'expired');
});

test('my bookings: own only, address revealed after confirmation, allowed actions', async () => {
  const mine = await as(U.custD, `select * from my_bookings()`);
  assert.ok(mine.length >= 3);
  const ownIds = (await as(U.custD, `select id from bookings`)).map((r) => r.id).sort();
  assert.deepEqual(mine.map((r) => r.id).sort(), ownIds);
  assert.ok(mine.every((r) => r.business_name === 'הציפורניים של א'));

  // עסק א הוא עסק מהבית: הכתובת רק בתור מאושר
  const confirmed = mine.find((r) => r.status === 'confirmed');
  assert.equal(confirmed.street, 'הנרקיסים');
  assert.equal(confirmed.house_number, '12');
  assert.equal(confirmed.can_cancel, true);
  assert.equal(confirmed.cancel_is_late, false); // יומיים קדימה, חלון של 24 שעות
  const rejected = mine.find((r) => r.status === 'rejected');
  assert.equal(rejected.street, null);
  assert.equal(rejected.can_cancel, false);
  assert.equal(mine.find((r) => r.status === 'expired').can_cancel, false);

  assert.equal((await as(U.ownerB, `select * from my_bookings()`)).length, 0); // אין רשומת לקוחה
  await fails(as(null, `select * from my_bookings()`), 'permission denied');
});

test('favorites: toggle, private per customer, creates the customer record', async () => {
  const toggle = (uid) => as(uid, `select toggle_favorite($1) as on`, [bizA]).then((r) => r[0].on);
  assert.equal(await toggle(U.custC), true);
  assert.deepEqual((await as(U.custC, `select business_id from favorites`)).map((r) => r.business_id), [bizA]);
  assert.equal((await as(U.custD, `select * from favorites`)).length, 0);
  assert.equal(await toggle(U.custC), false);
  assert.equal((await as(U.custC, `select * from favorites`)).length, 0);

  // למשתמש בלי רשומת לקוחה נוצרת אחת
  assert.equal(await toggle(U.ownerB), true);
  assert.equal((await su(`select count(*)::int n from customers where phone = '972500000002'`))[0].n, 1);
  // הוספה ישירה חסומה, גם לעצמך — רק דרך toggle_favorite
  await fails(as(U.custC, `insert into favorites (customer_id, business_id) select id, $1 from customers`, [bizA]),
    'row-level security');
  await fails(as(null, `select toggle_favorite($1)`, [bizA]), 'permission denied');
});

test('suspended business disappears', async () => {
  await su(`update businesses set status = 'suspended' where id = $1`, [bizB]);
  assert.deepEqual((await as(null, `select id from businesses`)).map((r) => r.id), [bizA]);
  assert.equal((await slots(null, bizB, [haircut], D2)).length, 0);
  await fails(book(U.custD, bizB, [haircut], await at(D2, '10:00')), 'business_not_found');
});

test('MIPO demo seed loads: 10 listed businesses, every service matched a category', async () => {
  await db.exec(readFileSync(new URL('../seed_mipo_demo.sql', here), 'utf8'));
  const rows = await su(`select b.slug, count(s.id)::int n from businesses b left join services s on s.business_id = b.id
                         where b.slug like 'mipo-demo-%' group by b.slug`);
  assert.equal(rows.length, 10);
  for (const r of rows) assert.ok(r.n > 0, `${r.slug} has no services`);
  const [{ n }] = await su(`select count(*)::int n from services s join businesses b on b.id = s.business_id where b.slug like 'mipo-demo-%'`);
  assert.equal(n, 18); // מספר השירותים שהוגדרו ב-seed — אם קטגוריה לא נמצאה, השירות היה נעלם בשקט

  // עסק דמה מקבל משבצות אמיתיות מהמנוע (שבוע קדימה, כך שלא תלוי ביום בשבוע)
  const [{ id, svc }] = await su(`select b.id, min(s.id::text)::uuid svc from businesses b join services s on s.business_id = b.id
                                  where b.slug = 'mipo-demo-barber' group by b.id`);
  assert.ok((await slots(null, id, [svc], 0, 7)).length > 0);
});
