import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { nextSlots, type Listing } from '../lib/discovery';
import { formatPrice } from '../lib/format';
import { relativeDay, timeLabel } from '../features/book/datetime';
import Icon from './Icon';
import FavButton from '../features/me/FavButton';
import { useFavorites } from '../features/me/useFavorites';

/**
 * כרטיס עסק. mini — לגלילה האופקית ("זמינים עכשיו"); wide — לרשימת התוצאות,
 * עם שעות פנויות קרובות שאפשר ללחוץ עליהן ישר.
 */
export default function BizCard({ listing, variant = 'mini' }: { listing: Listing; variant?: 'mini' | 'wide' }) {
  const { business: b, categoryNames, minPrice } = listing;
  const [slots, setSlots] = useState<string[] | null>(null);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    let alive = true;
    nextSlots(listing, variant === 'wide' ? 4 : 1).then((s) => alive && setSlots(s));
    return () => { alive = false; };
  }, [listing, variant]);

  const today = slots?.[0] && relativeDay(slots[0]) === 'היום';
  const loc = [b.city, b.neighborhood].filter(Boolean).join(' · ');
  const url = `/b/${b.slug}`;
  const media = b.image_url ? { backgroundImage: `url(${b.image_url})` } : undefined;

  return (
    <article className={`biz-card ${variant}`}>
      <div className="media-wrap">
        <Link to={url} className="media" style={media} aria-label={b.name}>
          {slots && slots.length > 0 && (
            <span className="badge-on-image">
              <span className="live">{today ? 'זמין היום' : 'זמין מחר'}</span>
            </span>
          )}
        </Link>
        <FavButton className="fav" on={isFavorite(b.id)} name={b.name} onClick={() => toggle(b.id)} />
      </div>
      <div className="body">
        <div className="row between" style={{ gap: '0.5rem' }}>
          <Link to={url} className="name" style={{ textDecoration: 'none' }}>{b.name}</Link>
          {b.rating != null && (
            <span className="rating">
              <Icon name="star" size={16} fill="currentColor" />
              {b.rating}
              {b.review_count != null && <small>({b.review_count})</small>}
            </span>
          )}
        </div>
        <div className="meta-line">
          {loc && <span><Icon name="pin" size={15} />{loc}</span>}
          {minPrice != null && <span>החל מ-{formatPrice(minPrice)}</span>}
        </div>
        {variant === 'wide' && categoryNames.length > 0 && (
          <div className="chips" style={{ gap: '0.3rem' }}>
            {categoryNames.slice(0, 4).map((n) => <span key={n} className="tag">{n}</span>)}
          </div>
        )}
        {slots === null ? (
          <span className="muted" style={{ fontSize: '0.82rem' }}>בודקים זמינות…</span>
        ) : slots.length === 0 ? (
          <span className="muted" style={{ fontSize: '0.82rem' }}>אין תורים פנויים היום ומחר</span>
        ) : variant === 'mini' ? (
          <span className="meta-line" style={{ color: 'var(--text)', fontWeight: 600 }}>
            <Icon name="clock" size={15} />
            {relativeDay(slots[0])} {timeLabel(slots[0])}
          </span>
        ) : (
          <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.25rem' }}>
            {slots.map((s) => (
              <Link key={s} to={`${url}?start=${encodeURIComponent(s)}`} className="slot-chip" style={{ textDecoration: 'none', display: 'grid', placeItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 500 }}>{relativeDay(s)}</span>
                {timeLabel(s)}
              </Link>
            ))}
            <Link to={url} className="btn small" style={{ marginInlineStart: 'auto' }}>קבע תור</Link>
          </div>
        )}
      </div>
    </article>
  );
}
