import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { WEEKDAYS } from '../../../lib/format';
import type { OpenHour } from '../../../lib/types';
import type { StepProps } from './types';

interface Day {
  open: boolean;
  opens: string;  // "09:00"
  closes: string;
}

const DEFAULT_DAY: Day = { open: false, opens: '09:00', closes: '19:00' };

/**
 * שעות פעילות. בממשק — משמרת אחת ליום (הסכימה כבר תומכת בכמה; מפוצלות
 * ייכנסו כשיהיה צורך). שמירה = החלפת כל השורות של העסק.
 */
export default function HoursStep({ business, onSaved, submitLabel, formId }: StepProps) {
  const b = business!;
  const [days, setDays] = useState<Day[]>(() => WEEKDAYS.map(() => ({ ...DEFAULT_DAY })));
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('calendars').select('id').eq('business_id', b.id).single<{ id: string }>(),
      supabase.from('open_hours').select('*').eq('business_id', b.id).order('opens'),
    ]).then(([cal, hours]) => {
      setCalendarId(cal.data?.id ?? null);
      const rows = (hours.data ?? []) as OpenHour[];
      setDays(
        WEEKDAYS.map((_, wd) => {
          const r = rows.find((h) => h.weekday === wd);
          return r ? { open: true, opens: r.opens.slice(0, 5), closes: r.closes.slice(0, 5) } : { ...DEFAULT_DAY };
        }),
      );
    });
  }, [b.id]);

  const update = (wd: number, patch: Partial<Day>) =>
    setDays((d) => d.map((day, i) => (i === wd ? { ...day, ...patch } : day)));

  function copyToWeekdays(from: number) {
    const src = days[from];
    setDays((d) => d.map((day, i) => (i <= 4 ? { ...src } : day))); // א'–ה'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!calendarId) return;
    if (days.some((d) => d.open && d.closes <= d.opens)) {
      setError('בכל יום פתוח, שעת הסגירה צריכה להיות אחרי שעת הפתיחה.');
      return;
    }
    if (!days.some((d) => d.open)) {
      setError('צריך לפחות יום פעילות אחד.');
      return;
    }
    setBusy(true);
    setError(null);
    const del = await supabase.from('open_hours').delete().eq('business_id', b.id);
    const ins = await supabase.from('open_hours').insert(
      days.flatMap((d, wd) =>
        d.open ? [{ business_id: b.id, calendar_id: calendarId, weekday: wd, opens: d.opens, closes: d.closes }] : [],
      ),
    );
    setBusy(false);
    if (del.error || ins.error) setError('השמירה נכשלה. אפשר לנסות שוב.');
    else onSaved(b);
  }

  return (
    <form id={formId} className="stack" onSubmit={submit}>
      <div className="card list" style={{ padding: '0.25rem 1rem' }}>
        {days.map((d, wd) => (
          <div key={wd} className="hours-row">
            <b>{WEEKDAYS[wd]}</b>
            <label className="switch">
              <input type="checkbox" checked={d.open} onChange={(e) => update(wd, { open: e.target.checked })} aria-label={`פתוח ביום ${WEEKDAYS[wd]}`} />
              <span />
            </label>
            {d.open ? (
              <div className="hours-times">
                <input type="time" step={900} value={d.opens} onChange={(e) => update(wd, { opens: e.target.value })} aria-label={`פתיחה ביום ${WEEKDAYS[wd]}`} />
                <span aria-hidden="true">–</span>
                <input type="time" step={900} value={d.closes} onChange={(e) => update(wd, { closes: e.target.value })} aria-label={`סגירה ביום ${WEEKDAYS[wd]}`} />
              </div>
            ) : (
              <span className="hours-closed">סגור</span>
            )}
          </div>
        ))}
      </div>
      {days[0].open && (
        <button type="button" className="btn ghost small" onClick={() => copyToWeekdays(0)}>
          להחיל את השעות של יום ראשון על ראשון–חמישי
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {submitLabel && <button className="btn" disabled={busy}>{busy ? 'שומרת…' : submitLabel}</button>}
    </form>
  );
}
