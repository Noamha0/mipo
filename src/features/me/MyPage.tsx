import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { displayPhone, formatPrice } from '../../lib/format';
import type { Business } from '../../lib/types';
import Icon from '../../ui/Icon';
import SiteFooter from '../../ui/SiteFooter';
import SiteHeader from '../../ui/SiteHeader';
import PhoneLogin from '../auth/PhoneLogin';
import { useSession } from '../auth/useSession';
import { timeLabel } from '../book/datetime';
import { useNow, whenLabel } from '../biz/calendar/parts';
import BottomNav from '../home/BottomNav';
import { errorText, meApi, type AltPreference, type Channel, type Consents, type MyBooking, type Profile } from './api';
import FavButton from './FavButton';
import { useFavorites } from './useFavorites';

type Tab = 'bookings' | 'favorites' | 'profile';
const TABS: [Tab, string][] = [['bookings', 'תורים'], ['favorites', 'מועדפים'], ['profile', 'פרופיל']];

/** צד הלקוחה: התורים שלי, מועדפים, ופרופיל (העדפת חלופות, ציון אמינות) */
export default function MyPage() {
  const { session, loading } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'bookings') as Tab;

  return (
    <div className="has-bottom-nav">
      <SiteHeader />
      <main className="page stack" style={{ paddingTop: '1.25rem' }}>
        {loading ? (
          <p className="muted" role="status">טוענים…</p>
        ) : !session ? (
          <PhoneLogin title="התורים שלי" subtitle="נכנסים עם הטלפון שאיתו קבעת, ורואים את כל התורים במקום אחד." />
        ) : (
          <>
            <h1>התורים שלי</h1>
            <div className="tabs" role="tablist" aria-label="האזור האישי">
              {TABS.map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams(key === 'bookings' ? {} : { tab: key }, { replace: true })}>
                  {label}
                </button>
              ))}
            </div>
            <BlockedNotice />
            {tab === 'bookings' && <Bookings />}
            {tab === 'favorites' && <Favorites />}
            {tab === 'profile' && <ProfileTab />}
          </>
        )}
      </main>
      <SiteFooter />
      <BottomNav active="appointments" />
    </div>
  );
}

// חשבון שנחסם ברמת המערכת (0005): אפשר לראות את התורים, אי אפשר לקבוע חדשים
function BlockedNotice() {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { meApi.profile().then((p) => setBlocked(Boolean(p.blocked_at))).catch(() => {}); }, []);
  if (!blocked) return null;
  return (
    <p className="notice warn" role="alert">
      <span>החשבון שלך מוגבל ואי אפשר לקבוע דרכו תורים חדשים. אם לדעתך זו טעות, <Link to="/contact" style={{ color: 'var(--accent)' }}>כתבו לנו</Link>.</span>
    </p>
  );
}

// ---------- תורים ----------

const STATUS: Record<MyBooking['status'], { label: string; tone: 'ok' | 'wait' | 'off' | 'bad' }> = {
  pending: { label: 'ממתין לאישור', tone: 'wait' },
  confirmed: { label: 'מאושר', tone: 'ok' },
  completed: { label: 'הגעת', tone: 'ok' },
  no_show: { label: 'סומן שלא הגעת', tone: 'bad' },
  rejected: { label: 'העסק לא אישר', tone: 'off' },
  expired: { label: 'לא נענה בזמן', tone: 'off' },
  cancelled_by_customer: { label: 'ביטלת', tone: 'off' },
  cancelled_by_business: { label: 'העסק ביטל', tone: 'off' },
};

function Bookings() {
  const [list, setList] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const load = useCallback(() => {
    meApi.bookings().then((l) => { setList(l); setError(null); }).catch(() => setError('לא הצלחנו לטעון את התורים. אפשר לנסות שוב.'));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="notice warn" role="alert">{error}</p>;
  if (!list) return <p className="muted" role="status">טוענים…</p>;

  const upcoming = list.filter((b) => ['pending', 'confirmed'].includes(b.status) && new Date(b.ends_at).getTime() > now).reverse();
  const past = list.filter((b) => !upcoming.includes(b));

  if (!list.length) {
    return (
      <section className="card stack-sm" style={{ textAlign: 'center', alignItems: 'center', padding: '2rem 1.25rem' }}>
        <span className="cat-icon" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="calendar" size={26} /></span>
        <h2>עוד אין לך תורים</h2>
        <p className="muted">מוצאים שירות שזמין עכשיו וקובעים בלחיצה.</p>
        <Link to="/search" className="btn">לכל השירותים</Link>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="stack-sm">
        <h2>קרובים</h2>
        {upcoming.length ? upcoming.map((b) => <BookingCard key={b.id} b={b} now={now} onChange={load} />)
          : <p className="muted">אין תורים קרובים. <Link to="/search" style={{ color: 'var(--accent)' }}>לקביעת תור</Link></p>}
      </section>
      {past.length > 0 && (
        <section className="stack-sm">
          <h2>קודמים</h2>
          {past.map((b) => <BookingCard key={b.id} b={b} now={now} onChange={load} />)}
        </section>
      )}
    </div>
  );
}

function BookingCard({ b, now, onChange }: { b: MyBooking; now: number; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = STATUS[b.status];
  const address = b.street ? [`${b.street}${b.house_number ? ' ' + b.house_number : ''}`, b.city].filter(Boolean).join(', ') : null;
  const wa = b.business_phone ? b.business_phone.replace(/\D/g, '').replace(/^0/, '972') : null;
  const ended = new Date(b.ends_at).getTime() < now;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); onChange(); } catch (e) { setError(errorText(e)); setBusy(false); }
  }

  return (
    <article className={`card stack-sm my-booking${s.tone === 'off' ? ' faded' : ''}`} style={{ padding: '1rem' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="my-thumb" style={b.business_image ? { backgroundImage: `url(${b.business_image})` } : undefined} aria-hidden="true" />
        <div className="stack-sm" style={{ gap: '0.1rem', flex: 1, minWidth: 0 }}>
          <Link to={`/b/${b.business_slug}`} style={{ fontWeight: 700, textDecoration: 'none' }}>{b.business_name}</Link>
          <span>{whenLabel(b.starts_at)} · <span className="ltr">{timeLabel(b.starts_at)}–{timeLabel(b.ends_at)}</span></span>
          <span className="muted">{b.services}{b.total_price != null && ` · ${formatPrice(b.total_price)}`}</span>
        </div>
        <span className={`tag cal-tag ${s.tone}`}>{s.label}</span>
      </div>

      {['pending', 'confirmed'].includes(b.status) && !ended && (
        address ? (
          <p className="meta-line" style={{ color: 'var(--text)' }}>
            <span><Icon name="pin" size={16} />{address}</span>
            {b.entrance_notes && <span className="muted">{b.entrance_notes}</span>}
            <a href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>ניווט</a>
          </p>
        ) : (
          <p className="meta-line"><span><Icon name="pin" size={16} />{[b.neighborhood, b.city].filter(Boolean).join(', ')}</span><span>הכתובת המלאה תופיע כאן כשהעסק יאשר</span></p>
        )
      )}

      {b.status === 'pending' && b.approval_deadline && (
        <p className="notice warn"><Icon name="clock" /><span>העסק יאשר עד <span className="ltr">{timeLabel(b.approval_deadline)}</span>. עד אז השעה שמורה לך.</span></p>
      )}
      {(b.status === 'rejected' || b.status === 'expired') && (
        <p className="muted">{b.status === 'rejected' ? 'העסק לא יכול בשעה הזו.' : 'העסק לא הספיק לענות, והשעה שוחררה.'} אפשר לבחור מועד אחר.</p>
      )}
      {b.status === 'cancelled_by_customer' && b.late_cancel && <p className="muted">ביטול מאוחר, בתוך חלון הביטול של העסק.</p>}

      {b.status === 'no_show' && (b.can_dispute ? (
        <div className="stack-sm">
          <p className="muted">העסק סימן שלא הגעת. אם הגעת, אפשר לערער. עד שהעסק יחליט, זה לא נספר בציון שלך.</p>
          <button className="btn secondary small" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => meApi.dispute(b.id))}>הגעתי, לערעור</button>
        </div>
      ) : b.no_show_disputed_at && <p className="muted">הערעור נשלח לעסק.</p>)}

      {confirming ? (
        <div className="stack-sm">
          <p className={b.cancel_is_late ? 'notice warn' : 'muted'}>
            {b.cancel_is_late
              ? 'התור קרוב מדי: ביטול עכשיו נחשב ביטול מאוחר, ונספר (בחצי משקל) בציון האמינות שלך.'
              : 'לבטל את התור? השעה תתפנה לאחרים.'}
          </p>
          <div className="row" style={{ gap: '0.6rem' }}>
            <button className="btn danger small" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => meApi.cancel(b.id))}>כן, לבטל</button>
            <button className="btn secondary small" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirming(false)}>לא</button>
          </div>
        </div>
      ) : (
        <div className="row wrap" style={{ gap: '0.5rem' }}>
          {wa && !ended && ['pending', 'confirmed'].includes(b.status) && (
            <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><Icon name="chat" size={18} />הודעה לעסק</a>
          )}
          {(ended || s.tone === 'off') && <Link className="chip" to={`/b/${b.business_slug}`}><Icon name="calendar" size={18} />קביעה מחדש</Link>}
          {b.can_cancel && (
            <button className="btn ghost small" style={{ color: 'var(--danger)', marginInlineStart: 'auto' }} onClick={() => setConfirming(true)}>ביטול התור</button>
          )}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

// ---------- מועדפים ----------

function Favorites() {
  const [list, setList] = useState<Business[] | null>(null);
  const { isFavorite, toggle } = useFavorites();
  useEffect(() => { meApi.favorites().then(setList).catch(() => setList([])); }, []);

  if (!list) return <p className="muted" role="status">טוענים…</p>;
  if (!list.length) {
    return (
      <section className="card stack-sm" style={{ textAlign: 'center', alignItems: 'center', padding: '2rem 1.25rem' }}>
        <span className="cat-icon" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="heart" size={26} /></span>
        <h2>אין עדיין מועדפים</h2>
        <p className="muted">לוחצים על הלב בכרטיס של עסק, והוא נשמר כאן לקביעה מהירה.</p>
        <Link to="/search" className="btn">לכל השירותים</Link>
      </section>
    );
  }
  return (
    <div className="stack-sm">
      {list.map((b) => (
        <article key={b.id} className="card row" style={{ padding: '0.75rem' }}>
          <span className="my-thumb" style={b.image_url ? { backgroundImage: `url(${b.image_url})` } : undefined} aria-hidden="true" />
          <div className="stack-sm" style={{ gap: 0, flex: 1, minWidth: 0 }}>
            <Link to={`/b/${b.slug}`} style={{ fontWeight: 700, textDecoration: 'none' }}>{b.name}</Link>
            <span className="muted">{[b.city, b.neighborhood].filter(Boolean).join(' · ')}</span>
          </div>
          <Link to={`/b/${b.slug}`} className="btn small">קביעת תור</Link>
          <FavButton on={isFavorite(b.id)} name={b.name} onClick={() => toggle(b.id)} />
        </article>
      ))}
    </div>
  );
}

// ---------- פרופיל ----------

const CHANNELS: [Channel, string][] = [['sms', 'SMS'], ['whatsapp', 'וואטסאפ'], ['email', 'מייל']];

const ALT: [AltPreference, string, string][] = [
  ['both', 'גם וגם', 'מועד אחר אצל אותו עסק, או עסק אחר באותו תחום'],
  ['same_business', 'רק אצל אותו עסק', 'נציע רק מועדים אחרים אצלו'],
  ['other_business', 'עסק אחר באותו תחום', 'נציע עסקים אחרים שפנויים באותה שעה'],
];

function ProfileTab() {
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [alt, setAlt] = useState<AltPreference>('both');
  const [saved, setSaved] = useState<Consents>({});
  const [consent, setConsent] = useState<Record<Channel, boolean>>({ sms: false, whatsapp: false, email: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([meApi.profile(), meApi.consents()]).then(([x, c]) => {
      setP(x); setName(x.name ?? ''); setEmail(x.email ?? ''); setAlt(x.alt_preference);
      setSaved(c);
      setConsent({ sms: Boolean(c.sms?.granted), whatsapp: Boolean(c.whatsapp?.granted), email: Boolean(c.email?.granted) });
    }).catch(() => setMsg({ ok: false, text: 'לא הצלחנו לטעון את הפרופיל.' }));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await meApi.saveProfile({ name, email, alt_preference: alt });
      // רק ערוצים שהשתנו נרשמים ביומן ההסכמות
      for (const ch of CHANNELS.map(([c]) => c)) {
        if (consent[ch] !== Boolean(saved[ch]?.granted)) await meApi.setConsent(ch, consent[ch], 'profile');
      }
      setSaved(await meApi.consents());
      setMsg({ ok: true, text: 'נשמר' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
    setBusy(false);
  }

  if (!p) return msg ? <p className="error" role="alert">{msg.text}</p> : <p className="muted" role="status">טוענים…</p>;

  return (
    <div className="stack">
      <section className="card stack-sm">
        <h2>האמינות שלך</h2>
        {p.score == null ? (
          <p className="muted">עוד אין מספיק היסטוריה. אחרי התור הראשון יופיע כאן אחוז ההגעה שלך.</p>
        ) : (
          <>
            <div className="row" style={{ gap: '0.6rem' }}>
              <b style={{ fontSize: '2rem', lineHeight: 1 }} className="ltr">{p.score}%</b>
              <span className="muted">הגעה לתורים ב-12 החודשים האחרונים</span>
            </div>
            <p className="muted">הגעת {p.attended} · לא הגעת {p.no_shows} · ביטולים מאוחרים {p.late_cancels}</p>
          </>
        )}
        <p className="muted" style={{ fontSize: '0.85rem' }}>עסקים יכולים לבקש אישור ידני מלקוחות עם אחוז נמוך. אין כאן כוכבים או ביקורות עלייך.</p>
      </section>

      <form className="card stack" onSubmit={save}>
        <label className="field">
          השם שלך
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="איך לקרוא לך?" />
          {p.phone && <small>טלפון: <span className="ltr">{displayPhone(p.phone)}</span></small>}
        </label>
        <label className="field">
          מייל <small>רשות</small>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" />
        </label>
        <fieldset className="field plain">
          <legend>אם העסק לא יוכל לאשר תור, מה להציע לך?</legend>
          <div className="stack-sm">
            {ALT.map(([key, title, desc]) => (
              <label key={key} className="choice">
                <input type="radio" name="alt" checked={alt === key} onChange={() => setAlt(key)} />
                <span><b>{title}</b><span className="muted">{desc}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field plain">
          <legend>עדכונים ומבצעים מעסקים ומ-MIPO</legend>
          <small style={{ marginBottom: '0.4rem' }}>רק אם תרצו. הודעות על התורים עצמם (אישור, תזכורת) נשלחות בכל מקרה. אפשר לבטל בכל רגע.</small>
          <div className="stack-sm">
            {CHANNELS.map(([ch, label]) => {
              const disabled = ch === 'email' && !email.trim();
              return (
                <label key={ch} className="row between" style={{ minHeight: 44, opacity: disabled ? 0.55 : 1 }}>
                  <span>
                    {label}
                    {saved[ch]?.granted && <small className="muted"> · אישרת ב-{new Date(saved[ch]!.updated_at).toLocaleDateString('he-IL')}</small>}
                    {disabled && <small className="muted"> · צריך מייל</small>}
                  </span>
                  <span className="switch">
                    <input type="checkbox" checked={consent[ch] && !disabled} disabled={disabled}
                      onChange={(e) => setConsent({ ...consent, [ch]: e.target.checked })} aria-label={`עדכונים ב${label}`} />
                    <span />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <button className="btn block" disabled={busy}>{busy ? 'שומרת…' : 'שמירה'}</button>
        {msg && <p className={msg.ok ? 'tag success' : 'error'} role={msg.ok ? 'status' : 'alert'} style={msg.ok ? { alignSelf: 'center' } : undefined}>{msg.text}</p>}
      </form>

      <button className="btn ghost" style={{ alignSelf: 'center' }} onClick={() => supabase.auth.signOut()}>
        <Icon name="logout" size={18} />יציאה
      </button>
    </div>
  );
}
