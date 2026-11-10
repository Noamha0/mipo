import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { displayPhone } from '../../lib/format';
import Icon from '../../ui/Icon';
import SiteHeader from '../../ui/SiteHeader';
import PhoneLogin from '../auth/PhoneLogin';
import { useSession } from '../auth/useSession';
import { adminApi, errorText, type AdminBusiness, type AdminCustomer, type BusinessStatus } from './api';

type Tab = 'businesses' | 'customers';
const TABS: [Tab, string][] = [['businesses', 'עסקים'], ['customers', 'לקוחות']];

/** מסך אדמין (0008): אישור עסקים להופעה בחיפוש, השעיה, וחסימת לקוחות לפי טלפון */
export default function AdminPage() {
  const { session, loading } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'businesses') as Tab;

  useEffect(() => {
    if (!session) return;
    adminApi.isAdmin().then(setAllowed).catch(() => setAllowed(false));
  }, [session]);

  return (
    <>
      <SiteHeader />
      <main className="page stack" style={{ paddingTop: '1.25rem' }}>
        {loading || (session && allowed === null) ? (
          <p className="muted" role="status">טוענים…</p>
        ) : !session ? (
          <PhoneLogin title="ניהול MIPO" subtitle="כניסה לצוות MIPO בלבד." />
        ) : !allowed ? (
          <section className="card stack-sm">
            <h1>אין הרשאה</h1>
            <p className="muted">המסך הזה מיועד לצוות MIPO.</p>
            <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => supabase.auth.signOut()}>
              <Icon name="logout" size={18} />יציאה
            </button>
          </section>
        ) : (
          <>
            <h1>ניהול MIPO</h1>
            <div className="tabs" role="tablist" aria-label="ניהול">
              {TABS.map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams(key === 'businesses' ? {} : { tab: key }, { replace: true })}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'businesses' ? <Businesses /> : <Customers />}
          </>
        )}
      </main>
    </>
  );
}

// ---------- עסקים ----------

const STATUS: Record<BusinessStatus, { label: string; tone: 'wait' | 'ok' | 'bad' }> = {
  pending: { label: 'ממתין לאישור', tone: 'wait' },
  listed: { label: 'מופיע בחיפוש', tone: 'ok' },
  suspended: { label: 'מושעה', tone: 'bad' },
};
const FILTERS: [BusinessStatus | 'all', string][] = [['pending', 'ממתינים'], ['listed', 'מופיעים'], ['suspended', 'מושעים'], ['all', 'הכול']];

function Businesses() {
  const [list, setList] = useState<AdminBusiness[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BusinessStatus | 'all'>('pending');

  const load = useCallback(() => {
    adminApi.businesses().then((l) => { setList(l); setError(null); }).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="notice warn" role="alert">{error}</p>;
  if (!list) return <p className="muted" role="status">טוענים…</p>;

  const count = (f: BusinessStatus | 'all') => (f === 'all' ? list.length : list.filter((b) => b.status === f).length);
  const shown = filter === 'all' ? list : list.filter((b) => b.status === filter);

  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="סינון לפי סטטוס">
        {FILTERS.map(([f, label]) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label} ({count(f)})
          </button>
        ))}
      </div>
      {shown.length ? shown.map((b) => <BusinessCard key={b.id} b={b} onChange={load} />)
        : <p className="muted">{filter === 'pending' ? 'אין עסקים שממתינים לאישור.' : 'אין עסקים כאן.'}</p>}
    </div>
  );
}

function BusinessCard({ b, onChange }: { b: AdminBusiness; onChange: () => void }) {
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = STATUS[b.status];

  async function set(status: BusinessStatus, why?: string) {
    setBusy(true);
    setError(null);
    try { await adminApi.setStatus(b.id, status, why); onChange(); } catch (e) { setError(errorText(e)); setBusy(false); }
  }

  return (
    <article className="card stack-sm" style={{ padding: '1rem' }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="stack-sm" style={{ gap: '0.1rem', minWidth: 0 }}>
          <Link to={`/b/${b.slug}`} target="_blank" style={{ fontWeight: 700, textDecoration: 'none' }}>{b.name}</Link>
          <span className="muted">{[b.neighborhood, b.city].filter(Boolean).join(', ') || 'בלי כתובת'} · נוצר {new Date(b.created_at).toLocaleDateString('he-IL')}</span>
        </div>
        <span className={`tag cal-tag ${s.tone}`}>{s.label}</span>
      </div>
      <dl className="facts">
        <dt>שירותים</dt><dd>{b.services || 'אין שירותים פעילים'}</dd>
        <dt>בעלים</dt><dd className="ltr" style={{ justifySelf: 'start' }}>{b.owner_phone ? displayPhone(b.owner_phone) : '—'}</dd>
        <dt>תורים</dt><dd>{b.bookings}</dd>
      </dl>
      {b.other_services > 0 && (
        <p className="notice"><span>{b.other_services === 1 ? 'שירות אחד' : `${b.other_services} שירותים`} בסוג "אחר". אולי כדאי להוסיף סוג שירות כזה לקטלוג.</span></p>
      )}

      {suspending ? (
        <div className="stack-sm">
          <label className="field">
            סיבת ההשעיה <small>נשמרת ביומן הפעולות</small>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="למשל: פרטים מטעים" />
          </label>
          <div className="row" style={{ gap: '0.6rem' }}>
            <button className="btn danger small" style={{ flex: 1 }} disabled={busy} onClick={() => set('suspended', reason)}>השעיה</button>
            <button className="btn secondary small" style={{ flex: 1 }} disabled={busy} onClick={() => setSuspending(false)}>ביטול</button>
          </div>
        </div>
      ) : (
        <div className="row wrap" style={{ gap: '0.5rem' }}>
          {b.status !== 'listed' && (
            <button className="btn small" disabled={busy} onClick={() => set('listed')}><Icon name="check" size={18} />אישור להופעה בחיפוש</button>
          )}
          {b.status === 'listed' && (
            <button className="btn secondary small" disabled={busy} onClick={() => set('pending')}>הסתרה מהחיפוש</button>
          )}
          {b.status === 'suspended' && (
            <button className="btn secondary small" disabled={busy} onClick={() => set('pending')}>ביטול ההשעיה</button>
          )}
          {b.status !== 'suspended' && (
            <button className="btn ghost small" style={{ color: 'var(--danger)', marginInlineStart: 'auto' }} disabled={busy} onClick={() => setSuspending(true)}>השעיה</button>
          )}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

// ---------- לקוחות ----------

function Customers() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<AdminCustomer | null | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try { setResult(await adminApi.findCustomer(phone)); } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }

  async function block(blocked: boolean) {
    setBusy(true);
    setError(null);
    try { await adminApi.setCustomerBlock(phone, blocked, reason); setReason(''); await find(); } catch (err) { setError(errorText(err)); setBusy(false); }
  }

  return (
    <div className="stack">
      <form className="row" style={{ gap: '0.6rem', alignItems: 'flex-end' }} onSubmit={find}>
        <label className="field" style={{ flex: 1 }}>
          טלפון של לקוח
          <input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-1234567" required />
        </label>
        <button className="btn" disabled={busy}>חיפוש</button>
      </form>

      {result === null && <p className="muted">אין לקוח עם המספר הזה.</p>}
      {result && (
        <article className="card stack-sm" style={{ padding: '1rem' }}>
          <div className="row between">
            <b>{result.name || 'בלי שם'}</b>
            {result.blocked_at ? <span className="tag cal-tag bad">חסום</span> : <span className="tag cal-tag ok">פעיל</span>}
          </div>
          <dl className="facts">
            <dt>טלפון</dt><dd className="ltr" style={{ justifySelf: 'start' }}>{displayPhone(result.phone)}</dd>
            <dt>תורים</dt><dd>{result.bookings}</dd>
            <dt>אי-הגעות</dt><dd>{result.no_shows ?? 0}</dd>
            <dt>אחוז הגעה</dt><dd>{result.score == null ? 'לקוח חדש' : `${result.score}%`}</dd>
            {result.blocked_at && (<><dt>נחסם</dt><dd>{new Date(result.blocked_at).toLocaleDateString('he-IL')}{result.blocked_reason && ` · ${result.blocked_reason}`}</dd></>)}
          </dl>
          {result.blocked_at ? (
            <button className="btn secondary small" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => block(false)}>ביטול החסימה</button>
          ) : (
            <div className="stack-sm">
              <label className="field">
                סיבה <small>הלקוח לא רואה אותה</small>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="למשל: הטרדת עסקים" />
              </label>
              <button className="btn danger small" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => block(true)}>
                חסימה בכל המערכת
              </button>
              <small className="muted">לקוח חסום לא יוכל לקבוע תורים חדשים בשום עסק. תורים קיימים נשארים.</small>
            </div>
          )}
        </article>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
