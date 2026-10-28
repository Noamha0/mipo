import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '../../../ui/Icon';
import { dayLabel, relativeDay } from '../../book/datetime';
import type { BookingStatus, CalBlock, CalBooking, CalendarApi } from './api';

export const STATUS: Record<BookingStatus, { label: string; tone: 'ok' | 'wait' | 'off' | 'bad' }> = {
  pending: { label: 'ממתין לאישור', tone: 'wait' },
  confirmed: { label: 'מאושר', tone: 'ok' },
  completed: { label: 'הגיעה', tone: 'ok' },
  no_show: { label: 'לא הגיעה', tone: 'bad' },
  rejected: { label: 'נדחה', tone: 'off' },
  expired: { label: 'פג תוקף', tone: 'off' },
  cancelled_by_customer: { label: 'הלקוחה ביטלה', tone: 'off' },
  cancelled_by_business: { label: 'בוטל על ידך', tone: 'off' },
};

export const SOURCE = { link: 'מהלינק האישי', search: 'מהחיפוש ב-MIPO', manual: 'נקלט ידנית' } as const;

/** תור שהתחיל ועוד לא סומן אם הגיעה */
export const needsMarking = (b: CalBooking, now: number) => b.status === 'confirmed' && new Date(b.starts_at).getTime() <= now;

export function StatusTag({ b, now }: { b: CalBooking; now: number }) {
  if (needsMarking(b, now)) return <span className="tag cal-tag wait">לסמן הגעה</span>;
  const s = STATUS[b.status];
  return <span className={`tag cal-tag ${s.tone}`}>{s.label}</span>;
}

/** ציון אמינות התנהגותי (החלטות 6, 13). בלי היסטוריה = לקוחה חדשה, לא ציון נמוך. */
export function Reliability({ b, detailed }: { b: CalBooking; detailed?: boolean }) {
  if (b.score == null) return <span className="tag rel new">לקוחה חדשה</span>;
  const tone = b.score >= 90 ? 'good' : b.score >= 70 ? 'mid' : 'low';
  return (
    <span className="stack-sm" style={{ gap: '0.2rem', alignItems: 'flex-start' }}>
      <span className={`tag rel ${tone}`} title="אחוז ההגעה ב-12 החודשים האחרונים">אמינות {b.score}%</span>
      {detailed && (
        <small className="muted">
          הגיעה {b.attended} · לא הגיעה {b.no_shows} · ביטולים מאוחרים {b.late_cancels}
          {b.visits > 0 && ` · ${b.visits} ביקורים אצלך`}
        </small>
      )}
    </span>
  );
}

/** "מחר, יום חמישי, 29 באוקטובר" — "היום"/"מחר" רק כשרלוונטי */
export function whenLabel(iso: string): string {
  const rel = relativeDay(iso);
  return rel === 'היום' || rel === 'מחר' ? `${rel}, ${dayLabel(iso)}` : dayLabel(iso);
}

/** "נותרו 42 דק'" עד המועד האחרון לאישור */
export function deadlineText(deadline: string | null, now: number): string {
  if (!deadline) return '';
  const min = Math.ceil((new Date(deadline).getTime() - now) / 60_000);
  if (min <= 0) return 'עבר הזמן לאישור';
  if (min < 60) return `נותרו ${min} דק' לאישור`;
  const h = Math.floor(min / 60);
  return `נותרו ${h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`}${min % 60 ? ` ו-${min % 60} דק'` : ''} לאישור`;
}

/** חלון תחתון במובייל, דיאלוג במרכז בדסקטופ. <dialog> נותן מלכודת פוקוס ו-Esc. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="sheet-body stack">
        <div className="row between">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="סגירה" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** שעון שמתקדם כל דקה — לקו "עכשיו" ולספירה לאחור של בקשות */
export function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

/** טוען טווח מהיומן ומתרענן לבד כשמשהו משתנה (Realtime) */
export function useRange(api: CalendarApi, from: string, to: string, onNew?: () => void) {
  const [data, setData] = useState<{ key: string; bookings: CalBooking[]; blocks: CalBlock[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${from}|${to}`;
  const onNewRef = useRef(onNew);
  useEffect(() => { onNewRef.current = onNew; });

  const reload = useCallback(async () => {
    try {
      const r = await api.load(from, to);
      setData({ key, ...r });
      setError(null);
    } catch {
      setError('לא הצלחנו לטעון את היומן. בדקי את החיבור ונסי שוב.');
    }
  }, [api, from, to, key]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => api.subscribe((isNew) => {
    void reload();
    if (isNew) onNewRef.current?.();
  }), [api, reload]);

  // בזמן מעבר בין ימים מציגים את הנתונים הקודמים רק אם הם לאותו טווח
  return { bookings: data?.key === key ? data.bookings : null, blocks: data?.key === key ? data.blocks : [], error, reload };
}
