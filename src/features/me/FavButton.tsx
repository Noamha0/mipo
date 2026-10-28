import Icon from '../../ui/Icon';

/** לב של מועדפים. עוצר את הלחיצה כדי שלא תפתח את הקישור של הכרטיס שמתחתיו. */
export default function FavButton({ on, name, onClick, className = 'icon-btn' }: { on: boolean; name: string; onClick: () => void; className?: string }) {
  return (
    <button className={`${className} fav-btn`} aria-pressed={on} aria-label={on ? `הסרת ${name} מהמועדפים` : `שמירת ${name} במועדפים`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}>
      <Icon name="heart" size={20} fill={on ? 'currentColor' : undefined} />
    </button>
  );
}
