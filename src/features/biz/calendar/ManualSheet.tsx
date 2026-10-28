import { useState } from 'react';
import { formatDuration, formatPrice } from '../../../lib/format';
import type { OpenHour, Service } from '../../../lib/types';
import { hhmm, timeToMin, weekdayOf, zonedIso } from '../../book/datetime';
import { errorText, type CalendarApi } from './api';
import { Sheet } from './parts';

export const TIMES = Array.from({ length: (23 - 6) * 4 }, (_, i) => hhmm(6 * 60 + i * 15)); // 06:00–22:45

/**
 * קליטה ידנית של תור שנקבע בוואטסאפ או בטלפון (החלטה 12). מאושר מיד ומשויך
 * ללקוחה לפי הטלפון. אפשר גם מחוץ לשעות הפעילות, כי העסק מחליט. רק חפיפה נחסמת.
 */
export default function ManualSheet({
  api, services, hours, day, time, onClose,
}: {
  api: CalendarApi; services: Service[]; hours: OpenHour[]; day: string; time: string; onClose: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(services[0] ? [services[0].id] : []));
  const [date, setDate] = useState(day);
  const [start, setStart] = useState(time);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = services.filter((s) => selected.has(s.id));
  const duration = chosen.reduce((n, s) => n + s.duration_min, 0);
  const price = chosen.reduce((n, s) => n + (s.price ?? 0), 0);
  const startMin = timeToMin(start);
  const inHours = hours.some((h) => h.weekday === weekdayOf(date) && timeToMin(h.opens) <= startMin && startMin + duration <= timeToMin(h.closes));
  const digits = phone.replace(/\D/g, '');
  const phoneOk = /^0\d{8,9}$/.test(digits) || /^972\d{8,9}$/.test(digits);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneOk) { setError('מספר הטלפון לא תקין. למשל 050-1234567.'); return; }
    if (!chosen.length) { setError('צריך לבחור לפחות שירות אחד.'); return; }
    setBusy(true);
    setError(null);
    try {
      await api.createManual({ phone: digits, name: name.trim(), serviceIds: chosen.map((s) => s.id), start: zonedIso(date, start) });
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="קליטת תור" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="muted">תור שסגרת בוואטסאפ או בטלפון. הוא נכנס ליומן כמאושר וחוסם את השעה.</p>
        <div className="row" style={{ gap: '0.6rem', alignItems: 'flex-start' }}>
          <label className="field" style={{ flex: 1 }}>
            טלפון
            <input type="tel" inputMode="tel" dir="ltr" autoComplete="off" placeholder="050-1234567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="field" style={{ flex: 1 }}>
            שם
            <input type="text" autoComplete="off" placeholder="איך לשמור אותה" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>

        <fieldset className="field plain">
          <legend>שירותים</legend>
          <div className="chips">
            {services.map((s) => (
              <button type="button" key={s.id} className="chip" aria-pressed={selected.has(s.id)} onClick={() => toggle(s.id)}>
                {s.name} · {formatDuration(s.duration_min)}
              </button>
            ))}
          </div>
          {services.length === 0 && <small>עוד אין שירותים. מוסיפים אותם בהגדרות.</small>}
        </fieldset>

        <div className="row" style={{ gap: '0.6rem' }}>
          <label className="field" style={{ flex: 1.4 }}>
            תאריך
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} required />
          </label>
          <label className="field" style={{ flex: 1 }}>
            שעה
            <select value={start} onChange={(e) => setStart(e.target.value)}>
              {!TIMES.includes(start) && <option value={start}>{start}</option>}
              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        {chosen.length > 0 && (
          <p className="muted">
            עד <span className="ltr">{hhmm(startMin + duration)}</span> · {formatDuration(duration)} · {formatPrice(price)}
          </p>
        )}
        {chosen.length > 0 && !inHours && <p className="notice warn">השעה מחוץ לשעות הפעילות. אפשר לקבוע בכל זאת.</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn block" disabled={busy}>{busy ? 'שומרת…' : 'שמירה ביומן'}</button>
      </form>
    </Sheet>
  );
}
