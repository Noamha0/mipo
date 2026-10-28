import { Link } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../lib/config';

/** תחתית האתר: קישורים לדפי המידע והמשפט */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="footer-links" aria-label="מידע ומשפטי">
        <Link to="/about">אודות</Link>
        <Link to="/contact">צור קשר</Link>
        <Link to="/terms">תקנון</Link>
        <Link to="/privacy">מדיניות פרטיות</Link>
        <Link to="/accessibility">הצהרת נגישות</Link>
      </nav>
      <p>© {APP_NAME} · {APP_TAGLINE}</p>
    </footer>
  );
}
