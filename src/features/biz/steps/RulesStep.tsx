import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatDuration } from '../../../lib/format';
import type { Business } from '../../../lib/types';
import type { StepProps } from './types';

type Approval = 'auto' | 'new' | 'all';

const HORIZONS = [7, 14, 21, 30, 45, 60];
const NOTICES = [0, 30, 60, 120, 240, 720, 1440];
const BUFFERS = [0, 5, 10, 15, 20, 30];
const CANCEL_WINDOWS = [0, 6, 12, 24, 48];

/** כללי הזמנה ואישור (החלטות 3, 4, 6, 13, 14) */
export default function RulesStep({ business, onSaved, submitLabel, formId }: StepProps) {
  const b = business!;
  const [approval, setApproval] = useState<Approval>(
    b.require_approval_all ? 'all' : b.require_approval_new ? 'new' : 'auto',
  );
  const [useReliability, setUseReliability] = useState(b.min_reliability_pct != null);
  const [minReliability, setMinReliability] = useState(b.min_reliability_pct ?? 80);
  const [horizon, setHorizon] = useState(b.booking_horizon_days);
  const [notice, setNotice] = useState(b.min_notice_minutes);
  const [buffer, setBuffer] = useState(b.buffer_minutes);
  const [cancelWindow, setCancelWindow] = useState(b.cancel_window_hours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('businesses')
      .update({
        require_approval_all: approval === 'all',
        require_approval_new: approval === 'new',
        min_reliability_pct: approval !== 'all' && useReliability ? minReliability : null,
        booking_horizon_days: horizon,
        min_notice_minutes: notice,
        buffer_minutes: buffer,
        cancel_window_hours: cancelWindow,
      })
      .eq('id', b.id)
      .select()
      .single<Business>();
    setBusy(false);
    if (error || !data) setError('השמירה נכשלה. אפשר לנסות שוב.');
    else onSaved(data);
  }

  const option = (value: Approval, title: string, text: string) => (
    <label className="choice">
      <input type="radio" name="approval" checked={approval === value} onChange={() => setApproval(value)} />
      <span>
        <b>{title}</b>
        <span className="muted">{text}</span>
      </span>
    </label>
  );

  return (
    <form id={formId} className="stack" onSubmit={submit}>
      <fieldset className="stack-sm" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="field" style={{ marginBlockEnd: '0.5rem' }}>מה קורה כשלקוחה מזמינה?</legend>
        {option('auto', 'התור נקבע מיד', 'הכי נוח ללקוחות. תמיד אפשר לבטל תור אם צריך.')}
        {option('new', 'לקוחה חדשה צריכה את האישור שלי', 'לקוחה שכבר הגיעה אלייך נקבעת מיד.')}
        {option('all', 'כל הזמנה צריכה את האישור שלי', 'המשבצת נשמרת ללקוחה עד שתעני.')}
      </fieldset>

      {approval !== 'all' && (
        <div className="card stack-sm">
          <div className="row between">
            <span>
              <b>אישור ידני ללקוחות עם אמינות נמוכה</b>
              <span className="muted" style={{ display: 'block' }}>האמינות מחושבת לפי הגעה לתורים בכל העסקים.</span>
            </span>
            <label className="switch">
              <input type="checkbox" checked={useReliability} onChange={(e) => setUseReliability(e.target.checked)} aria-label="אישור ידני לפי אמינות" />
              <span />
            </label>
          </div>
          {useReliability && (
            <label className="field">
              מתחת ל-
              <select value={minReliability} onChange={(e) => setMinReliability(Number(e.target.value))}>
                {[60, 70, 80, 90].map((p) => <option key={p} value={p}>{p}% הגעה</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {approval !== 'auto' && (
        <div className="notice">
          <p>על כל בקשה תקבלי הודעה, ויש לך <b>{formatDuration(b.approval_timeout_minutes)}</b> בשעות הפעילות לענות. אם לא תעני, הבקשה משתחררת והלקוחה מקבלת מועדים אחרים.</p>
        </div>
      )}

      <hr className="divider" />

      <label className="field">
        כמה זמן קדימה אפשר להזמין
        <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
          {HORIZONS.map((d) => <option key={d} value={d}>{d === 7 ? 'שבוע' : d === 14 ? 'שבועיים' : `${d} ימים`}</option>)}
        </select>
      </label>
      <label className="field">
        עד כמה זמן לפני התור אפשר להזמין
        <select value={notice} onChange={(e) => setNotice(Number(e.target.value))}>
          {NOTICES.map((m) => <option key={m} value={m}>{m === 0 ? 'עד הרגע האחרון' : m === 1440 ? 'יום לפני' : formatDuration(m) + ' לפני'}</option>)}
        </select>
      </label>
      <label className="field">
        הפסקה אחרי כל תור
        <select value={buffer} onChange={(e) => setBuffer(Number(e.target.value))}>
          {BUFFERS.map((m) => <option key={m} value={m}>{m === 0 ? 'בלי הפסקה' : formatDuration(m)}</option>)}
        </select>
        <small>זמן לניקוי ולהתארגנות בין לקוחות.</small>
      </label>
      <label className="field">
        ביטול בלי "קנס" באמינות עד
        <select value={cancelWindow} onChange={(e) => setCancelWindow(Number(e.target.value))}>
          {CANCEL_WINDOWS.map((h) => <option key={h} value={h}>{h === 0 ? 'אפשר לבטל עד הרגע האחרון' : h === 24 ? 'יום לפני' : h === 48 ? 'יומיים לפני' : `${h} שעות לפני`}</option>)}
        </select>
        <small>ביטול מאוחר יותר נחשב "ביטול מאוחר" ומוריד מעט מציון האמינות של הלקוחה.</small>
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      {submitLabel && <button className="btn" disabled={busy}>{busy ? 'שומרת…' : submitLabel}</button>}
    </form>
  );
}
