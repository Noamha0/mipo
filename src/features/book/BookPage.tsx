import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatDuration, formatPrice } from '../../lib/format';
import type { Business, Category, OpenHour, Service } from '../../lib/types';
import Brand from '../../ui/Brand';
import Icon from '../../ui/Icon';
import SiteHeader from '../../ui/SiteHeader';
import PhoneLogin from '../auth/PhoneLogin';
import { useSession } from '../auth/useSession';
import Confirm from './Confirm';
import { dayKey, dayLabel, relativeDay, shortDate, timeLabel } from './datetime';

type Step = 'browse' | 'confirm' | 'done';
interface Slot { slot_start: string; slot_end: string }

/** דף עסק: /b/<slug> — פרופיל, שירותים ומחירים, זמינות קרובה, קביעת תור. */
export default function BookPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { session } = useSession();

  const [business, setBusiness] = useState<Business | null | undefined>(undefined);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hours, setHours] = useState<OpenHour[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(params.get('start'));
  const [step, setStep] = useState<Step>('browse');
  const [bookedStatus, setBookedStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) return;
    supabase.from('businesses').select('*').eq('slug', slug).maybeSingle<Business>().then(async ({ data }) => {
      if (!alive) return;
      if (!data) { setBusiness(null); return; }
      setBusiness(data);
      const [s, c, h] = await Promise.all([
        supabase.from('services').select('*').eq('business_id', data.id).eq('active', true).order('sort_order'),
        supabase.from('categories').select('*'),
        supabase.from('open_hours').select('*').eq('business_id', data.id).order('weekday').order('opens'),
      ]);
      if (!alive) return;
      const list = (s.data ?? []) as Service[];
      setServices(list);
      setCategories((c.data ?? []) as Category[]);
      setHours((h.data ?? []) as OpenHour[]);
      // ברירת מחדל: השירות הקצר ביותר — אותו שירות שלפיו חושבו השעות בכרטיס החיפוש
      const shortest = [...list].sort((a, b) => a.duration_min - b.duration_min)[0];
      if (shortest) setSelected(new Set([shortest.id]));
    });
    return () => { alive = false; };
  }, [slug]);

  const chosen = useMemo(() => services.filter((s) => selected.has(s.id)), [services, selected]);
  const totalDuration = chosen.reduce((n, s) => n + s.duration_min, 0);
  const totalPrice = chosen.reduce((n, s) => n + (s.price ?? 0), 0);
  const idsKey = chosen.map((s) => s.id).join(',');

  // המשבצות מחושבות מחדש לכל שינוי בסל — משך שונה = שעות פנויות שונות
  useEffect(() => {
    if (!business || !idsKey) return;
    let alive = true;
    supabase
      .rpc('available_slots', { p_business_id: business.id, p_service_ids: idsKey.split(',') })
      .then(({ data }) => {
        if (!alive) return;
        const list = (data ?? []) as Slot[];
        setSlots(list);
        setStart((cur) => (cur && list.some((s) => s.slot_start === cur) ? cur : null));
        setDay((cur) => {
          const keys = new Set(list.map((s) => dayKey(s.slot_start)));
          if (cur && keys.has(cur)) return cur;
          const fromStart = params.get('start');
          if (fromStart && keys.has(dayKey(fromStart))) return dayKey(fromStart);
          return list[0] ? dayKey(list[0].slot_start) : null;
        });
      });
    return () => { alive = false; };
  }, [business, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s.slot_start);
      const arr = map.get(k);
      if (arr) arr.push(s); else map.set(k, [s]);
    }
    return [...map.entries()];
  }, [slots]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      return next;
    });
  }

  if (business === undefined) {
    return <main className="center-card"><p className="muted" role="status">טוענים…</p></main>;
  }
  if (business === null) {
    return (
      <main className="center-card stack">
        <Brand />
        <h1>הדף לא נמצא</h1>
        <p className="muted">הלינק אולי שגוי, או שהעסק כבר לא פעיל.</p>
        <button className="btn" onClick={() => nav('/search')}>לכל השירותים</button>
      </main>
    );
  }

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const tags = [...new Set(services.map((s) => catName.get(s.category_id)).filter(Boolean))] as string[];
  const loc = [business.city, business.neighborhood, business.address_mode === 'studio' ? business.street_public : null].filter(Boolean).join(' · ');
  const daySlots = days.find(([k]) => k === day)?.[1] ?? [];
  const waPhone = business.phone ? business.phone.replace(/\D/g, '').replace(/^0/, '972') : null;

  if (step !== 'browse') {
    return (
      <>
        <SiteHeader />
        <main className="page stack" style={{ paddingTop: '1.25rem' }}>
          <div className="row" style={{ gap: '0.5rem' }}>
            <span className="cat-icon" style={{ width: 44, height: 44, borderRadius: 14, background: business.image_url ? `center/cover url(${business.image_url})` : 'var(--hero)' }} />
            <div className="stack-sm" style={{ gap: 0 }}>
              <b>{business.name}</b>
              {loc && <span className="muted">{loc}</span>}
            </div>
          </div>
          {step === 'done' ? (
            <section className="card stack-sm" role="status">
              <span className="tag success" style={{ alignSelf: 'flex-start' }}>
                <Icon name="check" size={16} /> {bookedStatus === 'confirmed' ? 'התור נקבע' : 'הבקשה נשלחה'}
              </span>
              <h2>{bookedStatus === 'confirmed' ? 'נתראה בקרוב!' : 'ממתינים לאישור העסק'}</h2>
              <p className="muted">
                {bookedStatus === 'confirmed' ? 'התור אושר ונשמר ביומן של העסק.' : 'העסק יענה בתוך שעה בשעות הפעילות. אם לא יאשר, נציע לך מועדים אחרים.'}
              </p>
              <button className="btn secondary" onClick={() => nav('/')}>חזרה לדף הבית</button>
            </section>
          ) : session && start ? (
            <Confirm
              business={business} services={chosen} slotStart={start}
              totalDuration={totalDuration} totalPrice={totalPrice}
              onBack={() => setStep('browse')}
              onBooked={(st) => { setBookedStatus(st); setStep('done'); }}
            />
          ) : (
            <PhoneLogin title="כמעט סיימנו" subtitle="מאשרים את התור עם הטלפון, בלי סיסמה. נשלח קוד ב-SMS." />
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="page stack" style={{ paddingTop: '1rem', maxWidth: '46rem' }}>
        <div
          style={{
            position: 'relative', aspectRatio: '16 / 8', borderRadius: 'var(--radius)', overflow: 'hidden',
            background: business.image_url ? `center/cover url(${business.image_url})` : 'var(--hero)',
          }}
        >
          <button className="icon-btn" aria-label="חזרה" onClick={() => nav(-1)} style={{ position: 'absolute', top: 10, insetInlineStart: 10, background: 'rgb(255 255 255 / 0.94)', color: 'var(--text)' }}>
            <Icon name="back" />
          </button>
          {slots && slots.length > 0 && (
            <span className="badge-on-image" style={{ insetInlineStart: 'auto', insetInlineEnd: 10 }}>
              <span className="live">{relativeDay(slots[0].slot_start) === 'היום' ? 'זמין היום' : `פנוי ${relativeDay(slots[0].slot_start)}`}</span>
            </span>
          )}
        </div>

        <section className="stack-sm">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <h1 style={{ fontSize: '1.6rem' }}>{business.name}</h1>
            {business.rating != null && (
              <span className="rating" style={{ fontSize: '1rem', marginTop: '0.3rem' }}>
                <Icon name="star" size={18} fill="currentColor" />
                {business.rating}
                {business.review_count != null && <small>({business.review_count} ביקורות)</small>}
              </span>
            )}
          </div>
          <div className="meta-line">
            {loc && <span><Icon name="pin" size={16} />{loc}</span>}
            {business.address_mode === 'home' && <span>הכתובת המלאה נשלחת עם אישור התור</span>}
          </div>
          {tags.length > 0 && <div className="chips" style={{ gap: '0.35rem' }}>{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
          {business.description && <p style={{ color: 'var(--muted)' }}>{business.description}</p>}
          <div className="row wrap" style={{ gap: '0.5rem' }}>
            {waPhone && (
              <a className="chip" href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer"><Icon name="chat" size={18} />הודעה בוואטסאפ</a>
            )}
            {business.instagram_url && (
              <a className="chip" href={business.instagram_url} target="_blank" rel="noreferrer">אינסטגרם</a>
            )}
            {hours.length > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="clock" size={18} />{hoursSummary(hours)}</span>}
          </div>
        </section>

        <section className="card stack-sm" aria-labelledby="svc-h">
          <div className="section-head">
            <h2 id="svc-h">שירותים ומחירים</h2>
            <span className="muted" style={{ fontSize: '0.82rem' }}>אפשר לבחור כמה</span>
          </div>
          {services.length === 0 ? (
            <p className="muted">עדיין לא הוגדרו שירותים.</p>
          ) : (
            <div className="list">
              {services.map((s) => {
                const on = selected.has(s.id);
                return (
                  <div key={s.id} className="price-row">
                    <div className="stack-sm" style={{ gap: 0, minWidth: 0 }}>
                      <b>{s.name}</b>
                      <span className="muted" style={{ fontSize: '0.84rem' }}>{formatDuration(s.duration_min)}</span>
                    </div>
                    <span className="price">{formatPrice(s.price)}</span>
                    <button type="button" className="chip" aria-pressed={on} onClick={() => toggle(s.id)} aria-label={`${on ? 'הסרת' : 'בחירת'} ${s.name}`}>
                      {on ? <><Icon name="check" size={16} />נבחר</> : 'בחירה'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card stack" aria-labelledby="slots-h">
          <div className="section-head">
            <h2 id="slots-h">זמינות קרובה</h2>
            {chosen.length > 0 && <span className="muted" style={{ fontSize: '0.82rem' }}>ל{chosen.length > 1 ? `${chosen.length} שירותים` : chosen[0].name} · {formatDuration(totalDuration)}</span>}
          </div>
          {slots === null ? (
            <p className="muted" role="status">בודקים שעות פנויות…</p>
          ) : days.length === 0 ? (
            <div className="notice warn">אין תורים פנויים בימים הקרובים. כדאי לבדוק שוב מאוחר יותר, או לשלוח הודעה לעסק.</div>
          ) : (
            <>
              <div className="day-tabs" role="group" aria-label="יום">
                {days.map(([k, list]) => (
                  <button key={k} type="button" className="day-tab" aria-pressed={k === day} onClick={() => setDay(k)} aria-label={dayLabel(list[0].slot_start)}>
                    {relativeDay(list[0].slot_start)}
                    <b className="ltr">{shortDate(list[0].slot_start)}</b>
                  </button>
                ))}
              </div>
              <div className="slot-chips" role="group" aria-label="שעה">
                {daySlots.map((s) => (
                  <button key={s.slot_start} type="button" className="slot-chip" aria-pressed={s.slot_start === start} onClick={() => setStart(s.slot_start)}>
                    {timeLabel(s.slot_start)}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="sticky-cta">
          <button className="btn lg" disabled={!start || chosen.length === 0} onClick={() => { setStep('confirm'); window.scrollTo({ top: 0 }); }}>
            <Icon name="calendar" size={20} />
            {start ? `קבע תור · ${relativeDay(start)} ${timeLabel(start)}${totalPrice ? ` · ${formatPrice(totalPrice)}` : ''}` : 'בחרו שעה לקביעת תור'}
          </button>
        </div>
      </main>
    </>
  );
}

const DAY_LETTERS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", 'שבת'];

// "פתוח: א' ב' ג' ד' ה' ו'" — השעות המדויקות מוצגות בלוח הזמינות עצמו
function hoursSummary(hours: OpenHour[]): string {
  const days = [...new Set(hours.map((h) => h.weekday))].sort((a, b) => a - b);
  return 'פתוח: ' + days.map((d) => DAY_LETTERS[d]).join(' ');
}
