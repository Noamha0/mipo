import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadListings, type Listing } from '../../lib/discovery';
import { DEFAULT_CITY } from '../../lib/config';
import { SECTORS, sectorByKey } from '../../lib/sectors';
import BizCard from '../../ui/BizCard';
import Icon from '../../ui/Icon';
import SearchCard from '../../ui/SearchCard';
import SiteHeader from '../../ui/SiteHeader';
import BottomNav from '../home/BottomNav';
import SiteFooter from '../../ui/SiteFooter';

/** תוצאות חיפוש: ?q=&city=&sector= */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const city = params.get('city') ?? '';
  const sector = sectorByKey(params.get('sector'));
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

  const results = useMemo(() => {
    const term = q.trim();
    return (listings ?? []).filter(({ business: b, groups, categoryNames }) => {
      if (city && b.city !== city) return false;
      if (sector && !sector.groups.some((g) => groups.has(g))) return false;
      if (term) {
        const hay = [b.name, b.city, b.neighborhood, b.description, ...categoryNames].filter(Boolean).join(' ');
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [listings, q, city, sector]);

  function pickSector(key: string | null) {
    const next = new URLSearchParams(params);
    if (key) next.set('sector', key); else next.delete('sector');
    setParams(next, { replace: true });
  }

  const title = [sector?.name ?? (q ? `"${q}"` : 'כל השירותים'), city && `ב${city}`].filter(Boolean).join(' ');

  return (
    <div className="has-bottom-nav">
      <SiteHeader />
      <main className="page wide stack" style={{ paddingTop: '1.25rem' }}>
        <SearchCard key={`${q}|${city}`} cities={cities} initialQ={q} initialCity={city} sector={sector?.key} />

        <div className="chips" role="group" aria-label="תחום" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button type="button" className="chip" aria-pressed={!sector} onClick={() => pickSector(null)}>הכל</button>
          {SECTORS.map((s) => (
            <button type="button" key={s.key} className="chip" aria-pressed={sector?.key === s.key} onClick={() => pickSector(s.key)}>
              <Icon name={s.icon} size={18} />
              {s.name}
            </button>
          ))}
        </div>

        <div className="stack-sm" style={{ gap: '0.2rem' }}>
          <h1 style={{ fontSize: '1.5rem' }}>{title}</h1>
          {listings && <p className="muted">{results.length ? `${results.length} עסקים · התורים הפנויים מתעדכנים בזמן אמת` : ''}</p>}
        </div>

        {listings === null ? (
          <p className="muted" role="status">מחפשים…</p>
        ) : results.length === 0 ? (
          <div className="card stack-sm" style={{ alignItems: 'center', textAlign: 'center', padding: '2rem 1.25rem' }}>
            <span className="cat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="search" size={26} /></span>
            <b>לא מצאנו עסקים שמתאימים לחיפוש</b>
            <p className="muted">אפשר לנסות עיר אחרת, תחום אחר, או לחפש במילים אחרות.</p>
          </div>
        ) : (
          <div className="stack">
            {results.map((l) => <BizCard key={l.business.id} listing={l} variant="wide" />)}
          </div>
        )}
      </main>
      <SiteFooter />
      <BottomNav active="search" />
    </div>
  );
}
