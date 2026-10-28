import { useState } from 'react';
import type { OpenHour, Service } from '../../../lib/types';
import Icon from '../../../ui/Icon';
import { relativeDay, timeLabel } from '../../book/datetime';
import { errorText, type CalBooking, type CalendarApi } from './api';
import { Sheets, type Open } from './CalendarTab';
import { deadlineText, needsMarking, Reliability, whenLabel } from './parts';

/** מה שמחכה לעסק: בקשות לאישור, ערעורים על אי-הגעה, ותורים שעברו בלי סימון הגעה */
export default function RequestsTab({ api, bookings, services, hours, now }: {
  api: CalendarApi; bookings: CalBooking[] | null; services: Service[]; hours: OpenHour[]; now: number;
}) {
  const [open, setOpen] = useState<Open | null>(null);
  if (!bookings) return <p className="muted" role="status">טוענת…</p>;

  const pending = bookings.filter((b) => b.status === 'pending');
  const disputed = bookings.filter((b) => b.status === 'no_show' && b.no_show_disputed_at && !b.no_show_reaffirmed_at);
  const unmarked = bookings.filter((b) => needsMarking(b, now)).reverse();

  if (!pending.length && !disputed.length && !unmarked.length) {
    return (
      <section className="card stack-sm" style={{ textAlign: 'center', alignItems: 'center', padding: '2rem 1.25rem' }}>
        <span className="check-dot done" style={{ width: 44, height: 44 }}><Icon name="check" size={24} /></span>
        <h2>אין משהו שמחכה לך</h2>
        <p className="muted">בקשות חדשות שדורשות אישור יופיעו כאן, והיומן יתעדכן לבד.</p>
      </section>
    );
  }

  return (
    <div className="stack">
      {pending.length > 0 && (
        <section className="stack-sm">
          <h2>ממתינות לאישור ({pending.length})</h2>
          {pending.map((b) => <PendingCard key={b.id} b={b} api={api} now={now} onOpen={() => setOpen({ kind: 'booking', b })} />)}
        </section>
      )}
      {disputed.length > 0 && (
        <section className="stack-sm">
          <h2>ערעורים על אי-הגעה</h2>
          {disputed.map((b) => <Row key={b.id} b={b} note="טוענת שהגיעה" onOpen={() => setOpen({ kind: 'booking', b })} />)}
        </section>
      )}
      {unmarked.length > 0 && (
        <section className="stack-sm">
          <h2>לסמן הגעה</h2>
          <p className="muted">הסימון בונה את ציון האמינות של הלקוחות.</p>
          {unmarked.map((b) => <Row key={b.id} b={b} onOpen={() => setOpen({ kind: 'booking', b })} />)}
        </section>
      )}
      <Sheets open={open} api={api} services={services} hours={hours} now={now} onClose={() => setOpen(null)} />
    </div>
  );
}

function PendingCard({ b, api, now, onOpen }: { b: CalBooking; api: CalendarApi; now: number; onOpen: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try { await api.decide(b.id, approve); } catch (e) { setError(errorText(e)); setBusy(false); }
  };
  return (
    <article className="card stack-sm" style={{ padding: '1rem' }}>
      <button className="row between" style={{ textAlign: 'start', alignItems: 'flex-start' }} onClick={onOpen}>
        <span className="stack-sm" style={{ gap: '0.15rem' }}>
          <b>{b.customer_name || 'ללא שם'}</b>
          <span className="muted">{whenLabel(b.starts_at)} · <span className="ltr">{timeLabel(b.starts_at)}</span></span>
          <span className="muted">{b.services}</span>
        </span>
        <Reliability b={b} />
      </button>
      <p className="row" style={{ gap: '0.35rem', color: 'var(--warn-text)', fontWeight: 600, fontSize: '0.88rem' }}>
        <Icon name="clock" size={16} />{deadlineText(b.approval_deadline, now)}
      </p>
      <div className="row" style={{ gap: '0.6rem' }}>
        <button className="btn small" style={{ flex: 1 }} disabled={busy} onClick={() => decide(true)}><Icon name="check" size={18} />אישור</button>
        <button className="btn secondary small" style={{ flex: 1 }} disabled={busy} onClick={() => decide(false)}>דחייה</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

function Row({ b, note, onOpen }: { b: CalBooking; note?: string; onOpen: () => void }) {
  return (
    <button className="card row between" style={{ padding: '0.85rem 1rem', textAlign: 'start' }} onClick={onOpen}>
      <span className="stack-sm" style={{ gap: '0.1rem' }}>
        <b>{b.customer_name || 'ללא שם'}</b>
        <span className="muted">{relativeDay(b.starts_at)} · <span className="ltr">{timeLabel(b.starts_at)}</span> · {b.services}</span>
      </span>
      <span className="row" style={{ gap: '0.25rem' }}>
        {note && <span className="tag cal-tag wait">{note}</span>}
        <Icon name="next" size={20} />
      </span>
    </button>
  );
}
