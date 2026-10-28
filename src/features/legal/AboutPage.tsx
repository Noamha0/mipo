import { Link } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE, DEFAULT_CITY } from '../../lib/config';
import LegalPage from './LegalPage';

export default function AboutPage() {
  return (
    <LegalPage title={`אודות ${APP_NAME}`} dated={false}>
      <section>
        <p style={{ fontSize: '1.1rem' }}><b>{APP_TAGLINE}.</b></p>
        <p>
          {APP_NAME} מראה מי פנוי עכשיו באזור שלכם, מספרות ויופי ועד בעלי מקצוע, כושר, חיות מחמד ושיעורים, ומאפשר לקבוע תור
          בלחיצה. בלי טלפונים, בלי ״אחזור אלייך״ ובלי התכתבויות. השעות הפנויות מגיעות ישר מהיומן של העסק, כך שמה שרואים זה מה שיש.
        </p>
        <p>אנחנו מתחילים בפיילוט ב{DEFAULT_CITY}, עם עסקים מקומיים.</p>
      </section>

      <section>
        <h2>ללקוחות</h2>
        <ul>
          <li>רואים זמינות אמיתית וקובעים לבד, בכל שעה.</li>
          <li>כל התורים במקום אחד, ב<Link to="/me">״התורים שלי״</Link>, עם ביטול וניווט.</li>
          <li>השירות ללקוחות בחינם.</li>
        </ul>
      </section>

      <section>
        <h2>לעסקים</h2>
        <ul>
          <li>יומן שמתעדכן לבד, גם לתורים שנקבעו בוואטסאפ או בטלפון.</li>
          <li>שליטה מלאה: אישור אוטומטי או ידני, חלון ביטול, חסימות.</li>
          <li>ציון אמינות התנהגותי שעוזר להפחית אי־הגעות.</li>
        </ul>
        <p><Link to="/biz" className="btn small">הצטרפות לעסקים</Link></p>
      </section>
    </LegalPage>
  );
}
