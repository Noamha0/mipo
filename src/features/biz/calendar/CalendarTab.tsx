import { useState } from 'react';
import { formatPrice } from '../../../lib/format';
import type { OpenHour, Service } from '../../../lib/types';
import Icon from '../../../ui/Icon';
import {
  addDays, hhmm, keyToIso, minutesOfDay, relativeDay, shortDate, todayKey, weekStart, zonedIso,
} from '../../book/datetime';
import type { CalBlock, CalBooking, CalendarApi } from './api';
import BookingSheet from './BookingSheet';
import { BlockDetailsSheet, NewBlockSheet } from './BlockSheet';
import ManualSheet from './ManualSheet';
import { useNow, useRange, whenLabel } from './parts';
import { DayView, WeekView } from './Views';

export type Open =
  | { kind: 'booking'; b: CalBooking }
  | { kind: 'manual'; day: string; time: string }
  | { kind: 'newBlock'; day: string; time: string }
  | { kind: 'block'; block: CalBlock };

/** היומן: תצוגת יום או שבוע, ניווט בין תאריכים, קליטה ידנית וחסימות */
export default function CalendarTab({ api, services, hours }: { api: CalendarApi; services: Service[]; hours: OpenHour[] }) {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(todayKey);
  const [open, setOpen] = useState<Open | null>(null);
  const now = useNow();

  const week = weekStart(day);
  const from = view === 'day' ? zonedIso(day, '00:00') : zonedIso(week, '00:00');
  const to = view === 'day' ? zonedIso(addDays(day, 1), '00:00') : zonedIso(addDays(week, 7), '00:00');
  const { bookings, blocks, error, reload } = useRange(api, from, to);

  const step = view === 'day' ? 1 : 7;
  const isToday = day === todayKey();
  const label = view === 'day'
    ? whenLabel(keyToIso(day))
    : <span className="ltr">{shortDate(keyToIso(week))}–{shortDate(keyToIso(addDays(week, 6)))}</span>;

  const live = (bookings ?? []).filter((b) => ['pending', 'confirmed', 'completed', 'no_show'].includes(b.status));
  const revenue = live.filter((b) => b.status !== 'no_show').reduce((n, b) => n + Number(b.total_price ?? 0), 0);
  // ברירת מחדל לקליטה: השעה העגולה הבאה היום, או 10:00 ביום אחר
  const nextTime = isToday ? hhmm(Math.min(Math.ceil((minutesOfDay(new Date(now).toISOString()) + 1) / 30) * 30, 22 * 60)) : '10:00';

  return (
    <div className="stack">
      <div className="cal-head">
        <div className="row" style={{ gap: '0.25rem' }}>
          <button className="icon-btn" aria-label={view === 'day' ? 'היום הקודם' : 'השבוע הקודם'} onClick={() => setDay(addDays(day, -step))}>
            <Icon name="back" />
          </button>
          <h2 className="cal-title" aria-live="polite">{label}</h2>
          <button className="icon-btn" aria-label={view === 'day' ? 'היום הבא' : 'השבוע הבא'} onClick={() => setDay(addDays(day, step))}>
            <Icon name="next" />
          </button>
          {!isToday && <button className="btn ghost small" onClick={() => setDay(todayKey())}>להיום</button>}
        </div>
        <div className="seg" role="group" aria-label="תצוגה" style={{ minWidth: '11rem' }}>
          <button aria-pressed={view === 'day'} onClick={() => setView('day')}>יום</button>
          <button aria-pressed={view === 'week'} onClick={() => setView('week')}>שבוע</button>
        </div>
      </div>

      {view === 'day' && (
        <div className="day-tabs" role="group" aria-label="ימי השבוע">
          {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((k) => (
            <button key={k} className="day-tab" aria-pressed={k === day} onClick={() => setDay(k)}>
              {relativeDay(keyToIso(k))}
              <b className="ltr">{shortDate(keyToIso(k))}</b>
            </button>
          ))}
        </div>
      )}

      <div className="row between wrap" style={{ gap: '0.5rem' }}>
        <p className="muted" role="status">
          {bookings == null ? 'טוענת…' : live.length === 0 ? 'אין תורים' : `${live.length} תורים · ${formatPrice(revenue)}`}
        </p>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button className="btn secondary small" onClick={() => setOpen({ kind: 'newBlock', day, time: nextTime })}>
            <Icon name="ban" size={18} />חסימה
          </button>
          <button className="btn small" onClick={() => setOpen({ kind: 'manual', day, time: nextTime })}>
            <Icon name="plus" size={18} />קליטת תור
          </button>
        </div>
      </div>

      {error && (
        <div className="notice warn" role="alert">
          <p style={{ flex: 1 }}>{error}</p>
          <button className="btn ghost small" onClick={() => void reload()}>ניסיון חוזר</button>
        </div>
      )}

      {bookings && (view === 'day' ? (
        <DayView
          day={day} bookings={bookings} blocks={blocks} hours={hours} now={now}
          onBooking={(b) => setOpen({ kind: 'booking', b })}
          onBlock={(block) => setOpen({ kind: 'block', block })}
          onEmpty={(time) => setOpen({ kind: 'manual', day, time })}
        />
      ) : (
        <WeekView
          week={week} bookings={bookings} blocks={blocks} hours={hours} now={now}
          onBooking={(b) => setOpen({ kind: 'booking', b })}
          onBlock={(block) => setOpen({ kind: 'block', block })}
          onDay={(k) => { setDay(k); setView('day'); }}
        />
      ))}

      <Sheets open={open} api={api} services={services} hours={hours} now={now} onClose={() => setOpen(null)} />
    </div>
  );
}

export function Sheets({ open, api, services, hours, now, onClose }: {
  open: Open | null; api: CalendarApi; services: Service[]; hours: OpenHour[]; now: number; onClose: () => void;
}) {
  if (!open) return null;
  switch (open.kind) {
    case 'booking': return <BookingSheet b={open.b} api={api} now={now} onClose={onClose} />;
    case 'manual': return <ManualSheet api={api} services={services} hours={hours} day={open.day} time={open.time} onClose={onClose} />;
    case 'newBlock': return <NewBlockSheet api={api} day={open.day} time={open.time} onClose={onClose} />;
    case 'block': return <BlockDetailsSheet block={open.block} api={api} onClose={onClose} />;
  }
}
