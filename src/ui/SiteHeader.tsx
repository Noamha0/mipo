import { Link, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';

/** כותרת האתר: לוגו, ניווט (בדסקטופ), כניסה והרשמה לעסקים. */
export default function SiteHeader() {
  const nav = useNavigate();
  return (
    <header className="topbar">
      <Brand />
      <nav className="site-nav" aria-label="ניווט ראשי">
        <Link to="/search">כל השירותים</Link>
        <a href="/#how">איך זה עובד</a>
        <Link to="/biz">לעסקים</Link>
      </nav>
      <div className="row" style={{ gap: '0.4rem' }}>
        <Link to="/biz" className="btn small" style={{ boxShadow: 'none' }}>הרשמה לעסק</Link>
        <button className="icon-btn" aria-label="חיפוש" onClick={() => nav('/search')}>
          <Icon name="search" />
        </button>
      </div>
    </header>
  );
}
