import type { OpenHour } from '../../../lib/types';
import Icon from '../../../ui/Icon';
import {
  addDays, dayKey, hhmm, keyToIso, minutesOfDay, relativeDay, shortDate, timeLabel, timeToMin, todayKey, weekdayOf, zonedIso,
} from '../../book/datetime';
import { ACTIVE, type CalBlock, type CalBooking } from './api';
import { needsMarking, STATUS, StatusTag } from './parts';

const PX = 1.3; // פיקסלים לדקה: שעה = 78px

interface ViewProps {
  bookings: CalBooking[];
  blocks: CalBlock[];
  hours: OpenHour[];
  now: number;
  onBooking: (b: CalBooking) => void;
  onBlock: (b: CalBlock) => void;
}

const isActive = (b: CalBooking) => ACTIVE.includes(b.status);

function tone(b: CalBooking, now: number) {
  if (needsMarking(b, now)) return 'mark';
  return STATUS[b.status].tone;
}

/** יום כציר זמן: שעות פעילות בהיר, מחוץ לשעות מוצלל, לחיצה על זמן פנוי פותחת קליטת תור */
export function DayView({ day, onEmpty, ...p }: ViewProps & { day: string; onEmpty: (time: string) => void }) {
  const wd = weekdayOf(day);
  const open = p.hours.filter((h) => h.weekday === wd).map((h) => [timeToMin(h.opens), timeToMin(h.closes)] as const);
  const active = p.bookings.filter((b) => isActive(b) && dayKey(b.starts_at) === day);
  const inactive = p.bookings.filter((b) => !isActive(b) && dayKey(b.starts_at) === day);

  // הטווח: שעות הפעילות, מורחב לכל תור שנקבע מחוץ להן. חסימות נחתכות לטווח.
  const mins = [...open.flat(), ...active.flatMap((b) => [minutesOfDay(b.starts_at), endMin(b.ends_at, day)])];
  const start = Math.floor(Math.min(...(mins.length ? mins : [8 * 60])) / 60) * 60;
  const end = Math.ceil(Math.max(...(mins.length ? mins : [20 * 60]), start + 4 * 60) / 60) * 60;
  const y = (m: number) => (Math.min(Math.max(m, start), end) - start) * PX;

  const closed: [number, number][] = [];
  let cur = start;
  for (const [o, c] of [...open].sort((a, b) => a[0] - b[0])) {
    if (o > cur) closed.push([cur, o]);
    cur = Math.max(cur, c);
  }
  if (cur < end) closed.push([cur, end]);

  const dayStart = zonedIso(day, '00:00');
  const dayEnd = zonedIso(addDays(day, 1), '00:00');
  const blocks = p.blocks.filter((b) => b.starts_at < dayEnd && b.ends_at > dayStart);
  const nowMin = day === todayKey() ? minutesOfDay(new Date(p.now).toISOString()) : null;

  const rows = [];
  for (let m = start; m < end; m += 30) rows.push(m);

  return (
    <div className="stack-sm">
      {open.length === 0 && <p className="notice"><Icon name="clock" />העסק סגור ביום הזה. עדיין אפשר לקלוט תור ידנית.</p>}
      <div className="timeline" style={{ height: (end - start) * PX }}>
        {rows.map((m) => (
          <button key={m} className={`tl-slot${m % 60 === 0 ? ' hour' : ''}`} style={{ top: y(m), height: 30 * PX }}
            aria-label={`קליטת תור ב-${hhmm(m)}`} onClick={() => onEmpty(hhmm(m))}>
            {m % 60 === 0 && <span className="tl-hour">{hhmm(m)}</span>}
          </button>
        ))}
        {closed.map(([a, b]) => <div key={a} className="tl-closed" style={{ top: y(a), height: y(b) - y(a) }} />)}
        {blocks.map((bl) => {
          const a = bl.starts_at <= dayStart ? start : minutesOfDay(bl.starts_at);
          const b = bl.ends_at >= dayEnd ? end : minutesOfDay(bl.ends_at);
          if (b <= start || a >= end) return null;
          return (
            <button key={bl.id} className="tl-block" style={{ top: y(a), height: Math.max(y(b) - y(a), 24) }} onClick={() => p.onBlock(bl)}>
              <Icon name="ban" size={16} />{bl.reason || 'חסום'}
            </button>
          );
        })}
        {active.map((b) => {
          const a = minutesOfDay(b.starts_at);
          const h = Math.max(y(endMin(b.ends_at, day)) - y(a), 26);
          return (
            <button key={b.id} className={`tl-ev ${tone(b, p.now)}`} style={{ top: y(a), height: h }} onClick={() => p.onBooking(b)}
              aria-label={evLabel(b, p.now)}>
              <span className="row" style={{ gap: '0.4rem', minWidth: 0 }}>
                <b className="ltr">{timeLabel(b.starts_at)}</b>
                <span className="tl-name">{b.customer_name || 'ללא שם'}</span>
                {b.status === 'pending' && <span className="tag cal-tag wait">ממתין</span>}
                {needsMarking(b, p.now) && <span className="tag cal-tag wait">לסמן</span>}
                {b.score == null && b.status !== 'pending' && <span className="tag rel new">חדשה</span>}
              </span>
              {h >= 48 && <span className="tl-sub">{b.services}</span>}
            </button>
          );
        })}
        {nowMin != null && nowMin >= start && nowMin <= end && <div className="tl-now" style={{ top: y(nowMin) }} aria-hidden="true" />}
      </div>

      {inactive.length > 0 && (
        <details className="card section" style={{ padding: '0.25rem 1rem' }}>
          <summary>בוטלו או נדחו ({inactive.length})<Icon name="chevron" size={20} /></summary>
          <div className="list">
            {inactive.map((b) => (
              <button key={b.id} className="row between" style={{ textAlign: 'start' }} onClick={() => p.onBooking(b)}>
                <span><b className="ltr">{timeLabel(b.starts_at)}</b> {b.customer_name || 'ללא שם'}</span>
                <StatusTag b={b} now={p.now} />
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function evLabel(b: CalBooking, now: number) {
  const state = needsMarking(b, now) ? 'לסמן הגעה' : STATUS[b.status].label;
  return `${timeLabel(b.starts_at)} ${b.customer_name || 'ללא שם'}, ${b.services ?? ''}, ${state}`;
}

// תור שגולש אחרי חצות נחתך בסוף היום
function endMin(endsAt: string, day: string) {
  return dayKey(endsAt) === day ? minutesOfDay(endsAt) : 24 * 60;
}

/** שבוע: עמודה לכל יום בדסקטופ, רשימה לפי ימים במובייל */
export function WeekView({ week, onDay, ...p }: ViewProps & { week: string; onDay: (key: string) => void }) {
  const today = todayKey();
  return (
    <div className="week">
      {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((key) => {
        const list = p.bookings.filter((b) => isActive(b) && dayKey(b.starts_at) === key);
        const dayStart = zonedIso(key, '00:00');
        const dayEnd = zonedIso(addDays(key, 1), '00:00');
        const blocks = p.blocks.filter((b) => b.starts_at < dayEnd && b.ends_at > dayStart);
        const closed = !p.hours.some((h) => h.weekday === weekdayOf(key));
        return (
          <section key={key} className={`week-day${key === today ? ' today' : ''}${closed ? ' closed' : ''}`}>
            <button className="week-head" onClick={() => onDay(key)} aria-label={`לתצוגת יום ${relativeDay(keyToIso(key))} ${shortDate(keyToIso(key))}`}>
              <b>{relativeDay(keyToIso(key))}</b>
              <span className="muted ltr">{shortDate(keyToIso(key))}</span>
              <span className="week-count">{list.length ? `${list.length} תורים` : closed ? 'סגור' : 'פנוי'}</span>
            </button>
            <div className="stack-sm" style={{ gap: '0.35rem' }}>
              {blocks.map((bl) => (
                <button key={bl.id} className="week-block" onClick={() => p.onBlock(bl)}>
                  <Icon name="ban" size={14} />
                  {bl.starts_at <= dayStart && bl.ends_at >= dayEnd ? 'כל היום' : <span className="ltr">{timeLabel(bl.starts_at)}</span>}
                  {' '}{bl.reason || 'חסום'}
                </button>
              ))}
              {list.map((b) => (
                <button key={b.id} className={`week-ev ${tone(b, p.now)}`} onClick={() => p.onBooking(b)} aria-label={evLabel(b, p.now)}>
                  <b className="ltr">{timeLabel(b.starts_at)}</b>
                  <span className="tl-name">{b.customer_name || 'ללא שם'}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
