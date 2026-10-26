import { Link } from 'react-router-dom';

// לוגו MIPO: מילה שחורה ומעוגלת, נקודת ה-i בטורקיז, וה-O היא סיכת מיקום
// בגרדיאנט עם שלוש קרניים ("זמין עכשיו"). הסיכה לבדה = סימן/פאביקון.

/** סיכת המיקום — ה-O של MIPO. משמשת גם כאייקון האפליקציה. */
export function BrandMark({ size = 30, rays = true }: { size?: number; rays?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="mipo-pin">
      <defs>
        <linearGradient id="mipo-pin-g" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#5ef2dc" />
          <stop offset="0.55" stopColor="#14c3c3" />
          <stop offset="1" stopColor="#0b6f8c" />
        </linearGradient>
        <linearGradient id="mipo-fold-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0aa6b5" stopOpacity="0.55" />
          <stop offset="1" stopColor="#075d78" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {rays && (
        <g stroke="#14c8c0" strokeWidth="3.4" strokeLinecap="round">
          <path d="M35.2 4.2l.9 5.2" />
          <path d="M43.1 8.8l-3.6 4.2" />
          <path d="M45.6 17.6l-5 1" />
        </g>
      )}
      <ellipse cx="22" cy="45" rx="10" ry="1.8" fill="#14c8c0" opacity="0.22" />
      <path
        d="M22 8.5c8.6 0 15 6.3 15 14.3 0 5.6-3.4 10.4-8.3 15.4L22 44.6l-6.7-6.4C10.4 33.2 7 28.4 7 22.8 7 14.8 13.4 8.5 22 8.5z"
        fill="url(#mipo-pin-g)"
      />
      {/* קיפול כהה בצד — נותן לסיכה את העומק מהלוגו המקורי */}
      <path d="M22 44.6l6.7-6.4c4.9-5 8.3-9.8 8.3-15.4 0-3.6-1.3-6.9-3.5-9.4 1 5.8-1.6 13.8-11.5 31.2z" fill="url(#mipo-fold-g)" />
      <circle cx="22" cy="22.6" r="6.4" fill="#fff" />
    </svg>
  );
}

/** הלוגו המלא. size = גובה האותיות בפיקסלים. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="mipo-logo" style={{ fontSize: size }} aria-label="MIPO" role="img">
      <span aria-hidden="true">M</span>
      <span className="mipo-i" aria-hidden="true">ı</span>
      <span aria-hidden="true">P</span>
      <BrandMark size={size * 1.55} />
    </span>
  );
}

export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="MIPO — לדף הבית">
      <Logo />
    </Link>
  );
}
