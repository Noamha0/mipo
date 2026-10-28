import { useState } from 'react';
import { addDays, dayLabel, keyToIso, timeLabel, timeToMin, zonedIso } from '../../book/datetime';
import { errorText, type CalBlock, type CalendarApi } from './api';
import { Sheet } from './parts';
import { TIMES } from './ManualSheet';

/** חסימה ביומן (חופש, הפסקה, סידורים). תורים קיימים לא מתבטלים, רק לא נפתחות משבצות חדשות. */
export function NewBlockSheet({ api, day, time, onClose }: { api: CalendarApi; day: string; time: string; onClose: () => void }) {
  const [date, setDate] = useState(day);
  const [allDay, setAllDay] = useState(false);
  const [from, setFrom] = useState(time);
  const [to, setTo] = useState(TIMES[Math.min(TIMES.indexOf(time) + 4, TIMES.length - 1)] ?? '20:00');
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allDay && timeToMin(to) <= timeToMin(from)) { setError('שעת הסיום צריכה להיות אחרי שעת ההתחלה.'); return; }
    setBusy(true);
    setError(null);
    try {
      const start = allDay ? zonedIso(date, '00:00') : zonedIso(date, from);
      const end = allDay ? zonedIso(addDays(date, days), '00:00') : zonedIso(date, to);
      await api.addBlock(start, end, reason);
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="חסימת זמן" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="muted">בזמן החסום לא יוצגו שעות פנויות ללקוחות. תורים שכבר נקבעו נשארים.</p>
        <label className="field">
          תאריך
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="row between" style={{ minHeight: 44 }}>
          <span>יום שלם</span>
          <span className="switch"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /><span /></span>
        </label>
        {allDay ? (
          <label className="field">
            כמה ימים
            <select value={days} onChange={(e) => setDays(+e.target.value)}>
              {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? 'יום אחד' : `${n} ימים, עד ${dayLabel(keyToIso(addDays(date, n - 1)))}`}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="row" style={{ gap: '0.6rem' }}>
            <label className="field" style={{ flex: 1 }}>
              מ-
              <select value={from} onChange={(e) => setFrom(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              עד
              <select value={to} onChange={(e) => setTo(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
          </div>
        )}
        <label className="field">
          סיבה <small>רק את רואה אותה</small>
          <input type="text" placeholder="הפסקה, חופש, סידורים…" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'שומרת…' : 'חסימה'}</button>
      </form>
    </Sheet>
  );
}

export function BlockDetailsSheet({ block, api, onClose }: { block: CalBlock; api: CalendarApi; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sameDay = dayLabel(block.starts_at) === dayLabel(new Date(new Date(block.ends_at).getTime() - 1).toISOString());

  return (
    <Sheet title={block.reason || 'זמן חסום'} onClose={onClose}>
      <p>
        {dayLabel(block.starts_at)}
        {sameDay
          ? <>, <span className="ltr">{timeLabel(block.starts_at)}–{timeLabel(block.ends_at)}</span></>
          : <> עד {dayLabel(new Date(new Date(block.ends_at).getTime() - 1).toISOString())}</>}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <button
        className="btn secondary block"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await api.removeBlock(block.id); onClose(); } catch (e) { setError(errorText(e)); setBusy(false); }
        }}
      >
        הסרת החסימה
      </button>
    </Sheet>
  );
}
