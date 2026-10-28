import { useState } from 'react';
import { displayPhone, formatPrice } from '../../../lib/format';
import Icon from '../../../ui/Icon';
import { dayLabel, timeLabel } from '../../book/datetime';
import { errorText, type CalBooking, type CalendarApi } from './api';
import { deadlineText, needsMarking, Reliability, Sheet, SOURCE, StatusTag } from './parts';

/** פרטי תור והפעולות שמותרות במצב שלו */
export default function BookingSheet({ b, api, now, onClose }: { b: CalBooking; api: CalendarApi; now: number; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState('');

  const started = new Date(b.starts_at).getTime() <= now;
  const pending = b.status === 'pending';
  const disputed = b.status === 'no_show' && b.no_show_disputed_at && !b.no_show_reaffirmed_at;
  const canMark = started && ['confirmed', 'completed', 'no_show'].includes(b.status);
  const canCancel = !started && (b.status === 'confirmed' || pending);
  const wa = b.customer_phone.replace(/\D/g, '');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title={b.customer_name || displayPhone(b.customer_phone)} onClose={onClose}>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        <StatusTag b={b} now={now} />
        <Reliability b={b} detailed />
      </div>

      <div className="row wrap" style={{ gap: '0.5rem' }}>
        <a className="chip" href={`tel:+${wa}`}><Icon name="phone" size={18} /><span className="ltr">{displayPhone(b.customer_phone)}</span></a>
        <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><Icon name="chat" size={18} />וואטסאפ</a>
      </div>

      <dl className="facts">
        <dt>מתי</dt>
        <dd>{dayLabel(b.starts_at)}, <span className="ltr">{timeLabel(b.starts_at)}–{timeLabel(b.ends_at)}</span></dd>
        <dt>מה</dt>
        <dd>{b.services ?? '—'}</dd>
        <dt>מחיר</dt>
        <dd>{formatPrice(b.total_price)}</dd>
        <dt>מקור</dt>
        <dd>{SOURCE[b.source]}</dd>
        {b.customer_notes && (<><dt>הערות</dt><dd>{b.customer_notes}</dd></>)}
        {b.late_cancel && (<><dt>ביטול</dt><dd>ביטול מאוחר, בתוך חלון הביטול שלך</dd></>)}
      </dl>

      {pending && (
        <div className="stack-sm">
          <p className="notice warn"><Icon name="clock" />{deadlineText(b.approval_deadline, now)}. עד אז המשבצת שמורה לה.</p>
          <div className="row" style={{ gap: '0.6rem' }}>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.decide(b.id, true))}>
              <Icon name="check" size={20} />אישור
            </button>
            <button className="btn secondary" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.decide(b.id, false))}>
              דחייה
            </button>
          </div>
        </div>
      )}

      {disputed && (
        <div className="stack-sm">
          <p className="notice warn">הלקוחה מערערת וטוענת שהגיעה. עד שתחליטי, אי-ההגעה לא נספרת בציון שלה.</p>
          <div className="row" style={{ gap: '0.6rem' }}>
            <button className="btn secondary" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, true))}>
              היא צודקת, הגיעה
            </button>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.reaffirmNoShow(b.id))}>
              לא הגיעה
            </button>
          </div>
        </div>
      )}

      {canMark && !disputed && (
        <div className="stack-sm">
          <b>{needsMarking(b, now) ? 'הלקוחה הגיעה?' : 'סימון הגעה'}</b>
          <div className="seg" role="group" aria-label="סימון הגעה">
            <button aria-pressed={b.status === 'completed'} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, true))}>הגיעה</button>
            <button aria-pressed={b.status === 'no_show'} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, false))}>לא הגיעה</button>
          </div>
        </div>
      )}

      {canCancel && !pending && (
        confirmCancel ? (
          <div className="stack-sm">
            <p className="muted">לבטל את התור? המשבצת תיפתח שוב להזמנות. כדאי לעדכן את הלקוחה בוואטסאפ.</p>
            <div className="row" style={{ gap: '0.6rem' }}>
              <button className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.cancel(b.id))}>כן, לבטל</button>
              <button className="btn secondary" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirmCancel(false)}>לא</button>
            </div>
          </div>
        ) : (
          <button className="btn ghost" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => setConfirmCancel(true)}>
            ביטול התור
          </button>
        )
      )}

      <hr className="divider" />
      {b.blocked_here ? (
        <div className="stack-sm">
          <p className="notice warn"><Icon name="ban" /><span>חסומה אצלך: לא יכולה לקבוע כאן תורים דרך האתר.{b.block_reason && ` הסיבה שרשמת: ${b.block_reason}`}</span></p>
          <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} disabled={busy}
            onClick={() => run(() => api.setCustomerBlock(b.customer_id, false, ''))}>ביטול החסימה</button>
        </div>
      ) : blocking ? (
        <div className="stack-sm">
          <p className="muted">
            היא לא תוכל לקבוע אצלך תורים דרך האתר (תראה הודעה כללית, בלי פירוט). תורים קיימים לא מתבטלים, ואת עדיין יכולה לקלוט לה תור ידנית.
            אפשר לבטל את החסימה בכל רגע.
          </p>
          <label className="field">
            סיבה <small>רק את רואה אותה</small>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="למשל: לא הגיעה כמה פעמים" />
          </label>
          <div className="row" style={{ gap: '0.6rem' }}>
            <button className="btn danger small" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.setCustomerBlock(b.customer_id, true, reason))}>חסימה</button>
            <button className="btn secondary small" style={{ flex: 1 }} disabled={busy} onClick={() => setBlocking(false)}>ביטול</button>
          </div>
        </div>
      ) : (
        <button className="btn ghost small" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }} onClick={() => setBlocking(true)}>
          <Icon name="ban" size={18} />חסימת הלקוחה אצלי
        </button>
      )}

      {error && <p className="error" role="alert">{error}</p>}
    </Sheet>
  );
}
