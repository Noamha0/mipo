import { Link } from 'react-router-dom';
import { LEGAL } from '../../lib/config';
import Icon from '../../ui/Icon';
import LegalPage from './LegalPage';

const hasEmail = LEGAL.email.includes('@') && !LEGAL.email.includes('[');

export default function ContactPage() {
  return (
    <LegalPage title="צור קשר" dated={false}>
      <section className="card stack-sm">
        <h2>כתבו לנו</h2>
        <p className="muted">על כל נושא: שאלה, תקלה, הצעה, פרטיות או נגישות.</p>
        {hasEmail
          ? <a className="btn" style={{ alignSelf: 'flex-start' }} href={`mailto:${LEGAL.email}`}><Icon name="chat" size={20} />{LEGAL.email}</a>
          : <p><b>{LEGAL.email}</b></p>}
        <p className="muted">{LEGAL.operator} · {LEGAL.operatorId}</p>
      </section>

      <section>
        <h2>שאלות נפוצות</h2>
        <h3>יש בעיה עם תור שקבעתי</h3>
        <p>
          הכי מהיר לפנות ישירות לעסק: ב<Link to="/me">״התורים שלי״</Link> יש כפתור ״הודעה לעסק״ בוואטסאפ. משם אפשר גם לבטל תור.
        </p>
        <h3>סימנו שלא הגעתי, אבל הגעתי</h3>
        <p>ב״התורים שלי״ ← התור ← ״הגעתי, לערעור״. עד שהעסק מחליט, זה לא נספר בציון שלכם.</p>
        <h3>אני בעל עסק ורוצה להצטרף</h3>
        <p><Link to="/biz">נרשמים כאן</Link>, ותוך כמה דקות יש לכם יומן ולינק אישי.</p>
        <h3>בקשה לעיון במידע או למחיקתו</h3>
        <p>כתבו לנו מהטלפון שאיתו נרשמתם. פרטים ב<Link to="/privacy">מדיניות הפרטיות</Link>.</p>
      </section>
    </LegalPage>
  );
}
