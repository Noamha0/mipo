import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadListings, type Listing } from '../../lib/discovery';
import { DEFAULT_CITY } from '../../lib/config';
import { SECTORS } from '../../lib/sectors';
import { BrandMark } from '../../ui/Brand';
import BizCard from '../../ui/BizCard';
import Icon, { type IconName } from '../../ui/Icon';
import SearchCard from '../../ui/SearchCard';
import SiteFooter from '../../ui/SiteFooter';
import SiteHeader from '../../ui/SiteHeader';
import BottomNav from './BottomNav';

const FEATURES: { icon: IconName; text: string }[] = [
  { icon: 'heart', text: 'מגוון שירותים' },
  { icon: 'check', text: 'רואים מי זמין עכשיו' },
  { icon: 'pin', text: 'קרוב אליכם' },
  { icon: 'bolt', text: 'מוצאים במהירות' },
];

const STEPS = [
  { title: 'בוחרים שירות ומיקום', text: 'מחפשים לפי סוג שירות, שם עסק או עיר.' },
  { title: 'רואים מי פנוי עכשיו', text: 'התורים הפנויים מוצגים בזמן אמת, ישר מהיומן של העסק.' },
  { title: 'קובעים בלחיצה', text: 'בוחרים שעה ומקבלים אישור. בלי טלפונים ובלי התכתבויות.' },
];

/** דף הבית של MIPO */
export default function HomePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadListings().then(({ listings }) => alive && setListings(listings));
    return () => { alive = false; };
  }, []);

  const cities = useMemo(() => {
    const set = new Set((listings ?? []).map((l) => l.business.city).filter((c): c is string => Boolean(c)));
    return [...set].sort((a, b) => (a === DEFAULT_CITY ? -1 : b === DEFAULT_CITY ? 1 : a.localeCompare(b, 'he')));
  }, [listings]);

  const featured = (listings ?? []).slice(0, 10);

  return (
    <div className="has-bottom-nav">
      <SiteHeader />

      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="stack" style={{ gap: '1.25rem' }}>
            <span className="tag" style={{ alignSelf: 'flex-start' }}>כל השירותים המקומיים, במקום אחד</span>
            <h1>
              מחפשים שירות
              <br />
              <span className="headline-grad">זמין עכשיו?</span>
              <span className="underline-swoosh" aria-hidden="true" />
            </h1>
            <p style={{ fontSize: '1.08rem', color: 'var(--muted)', maxWidth: '34rem' }}>
              ב-MIPO תמצאו בעלי מקצוע ושירותים שזמינים באזור שלכם, בקלות ובמהירות.
            </p>
            <SearchCard cities={cities} />
          </div>
          <HeroArt />
        </div>
      </section>

      <main className="page wide stack" style={{ gap: '2.25rem', paddingTop: '1.75rem' }}>
        <section className="stack" aria-labelledby="cats-h">
          <h2 id="cats-h">מה אתם מחפשים?</h2>
          <div className="cat-grid">
            {SECTORS.slice(0, 7).map((s) => (
              <Link key={s.key} to={`/search?sector=${s.key}`} className="cat-tile">
                <span className="cat-icon" style={{ background: s.tint, color: s.ink }}><Icon name={s.icon} size={28} /></span>
                {s.name}
              </Link>
            ))}
            <Link to="/search" className="cat-tile">
              <span className="cat-icon" style={{ background: '#eef1f3', color: 'var(--muted)' }}><Icon name="dots" size={28} /></span>
              עוד קטגוריות
            </Link>
          </div>
        </section>

        <section className="stack-sm" aria-labelledby="now-h">
          <div className="section-head">
            <h2 id="now-h">זמינים עכשיו</h2>
            <Link to="/search">הצג הכל</Link>
          </div>
          {listings === null ? (
            <p className="muted" role="status">טוענים עסקים…</p>
          ) : featured.length === 0 ? (
            <div className="notice">עדיין אין עסקים פעילים. העסקים הראשונים מצטרפים בקרוב.</div>
          ) : (
            <div className="h-scroll">
              {featured.map((l) => <BizCard key={l.business.id} listing={l} />)}
            </div>
          )}
        </section>

        <section className="card features" aria-label="למה MIPO">
          {FEATURES.map((f) => (
            <div key={f.text} className="feature">
              <span className="ico"><Icon name={f.icon} size={22} /></span>
              {f.text}
            </div>
          ))}
        </section>

        <section id="how" className="stack" aria-labelledby="how-h">
          <h2 id="how-h">איך זה עובד?</h2>
          <div className="how">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card how-step">
                <span className="how-num">{i + 1}</span>
                <div className="stack-sm" style={{ gap: '0.2rem' }}>
                  <b>{s.title}</b>
                  <span className="muted">{s.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <div className="stack-sm">
            <h2 style={{ fontSize: '1.45rem' }}>יש לכם עסק?</h2>
            <p className="muted">לקוחות חדשים רואים מתי אתם פנויים וקובעים לבד. יומן, אישורים ותזכורות במקום אחד, בחינם בתקופת ההשקה.</p>
          </div>
          <Link to="/biz" className="btn lg">
            הרשמה לעסק
            <Icon name="arrow" size={20} />
          </Link>
        </section>
      </main>

      <SiteFooter />

      <BottomNav active="home" />
    </div>
  );
}

/** איור הגיבור (דסקטופ): סיכת המיקום הגדולה, ועליה תגיות "זמין עכשיו" של תחומים. */
function HeroArt() {
  const pills = [SECTORS[0], SECTORS[1], SECTORS[3], SECTORS[6]];
  const pos = [
    { top: '6%', right: '0%' },
    { top: '40%', left: '-6%' },
    { bottom: '18%', right: '-4%' },
    { bottom: '0%', left: '14%' },
  ];
  return (
    <div className="hero-art" aria-hidden="true" style={{ position: 'relative', width: 360, height: 340 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <BrandMark size={250} />
      </div>
      {pills.map((s, i) => (
        <div key={s.key} className="card" style={{ position: 'absolute', ...pos[i], display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.55rem 0.8rem', borderRadius: 16 }}>
          <span className="cat-icon" style={{ width: 38, height: 38, borderRadius: 12, background: s.tint, color: s.ink }}><Icon name={s.icon} size={20} /></span>
          <span className="stack-sm" style={{ gap: 0 }}>
            <b style={{ fontSize: '0.88rem' }}>{s.name}</b>
            <span className="live">זמין עכשיו</span>
          </span>
        </div>
      ))}
    </div>
  );
}
