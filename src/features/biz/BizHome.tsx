import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Business } from '../../lib/types';
import Brand from '../../ui/Brand';
import Icon from '../../ui/Icon';
import ShareLink from './ShareLink';
import DetailsStep from './steps/DetailsStep';
import LocationStep from './steps/LocationStep';
import ServicesStep from './steps/ServicesStep';
import HoursStep from './steps/HoursStep';
import RulesStep from './steps/RulesStep';

interface Setup {
  services: number;
  hours: number;
  location: boolean;
}

/** מסך הבית של העסק. היומן עצמו נכנס באבן דרך 3. */
export default function BizHome({ business, onBusiness }: { business: Business; onBusiness: (b: Business) => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('active', true),
      supabase.from('open_hours').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    ]).then(([s, h]) =>
      setSetup({ services: s.count ?? 0, hours: h.count ?? 0, location: Boolean(business.city) }),
    );
  }, [business]);

  const saved = (label: string) => (b: Business) => {
    onBusiness(b);
    setSavedMsg(`${label} נשמרו`);
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const todo = setup && [
    { done: setup.services > 0, text: 'להוסיף לפחות שירות אחד' },
    { done: setup.hours > 0, text: 'להגדיר שעות פעילות' },
    { done: setup.location, text: 'להוסיף כתובת' },
  ];
  const ready = todo?.every((t) => t.done);

  const sections = [
    { key: 'details', title: 'פרטי העסק', body: <DetailsStep business={business} onSaved={saved('הפרטים')} submitLabel="שמירה" /> },
    { key: 'location', title: 'מיקום', body: <LocationStep business={business} onSaved={saved('פרטי המיקום')} submitLabel="שמירה" /> },
    { key: 'services', title: 'שירותים ומחירים', body: <ServicesStep business={business} onSaved={saved('השירותים')} /> },
    { key: 'hours', title: 'שעות פעילות', body: <HoursStep business={business} onSaved={saved('השעות')} submitLabel="שמירה" /> },
    { key: 'rules', title: 'כללי הזמנה ואישור', body: <RulesStep business={business} onSaved={saved('הכללים')} submitLabel="שמירה" /> },
  ];

  return (
    <>
      <header className="topbar">
        <Brand />
        <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>
          <Icon name="logout" size={18} />
          יציאה
        </button>
      </header>

      <main className="page stack">
        <div className="hero stack-sm" style={{ borderRadius: 'var(--radius)' }}>
          <p className="muted">שלום,</p>
          <h1>{business.name}</h1>
          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <span className="tag" style={{ background: 'rgb(255 255 255 / 0.2)', color: '#fff' }}>
              {business.status === 'listed' ? 'מופיע בחיפוש' : 'הלינק האישי פעיל'}
            </span>
          </div>
        </div>

        {todo && !ready && (
          <section className="card stack-sm">
            <h2>כמה דברים לפני שמתחילים</h2>
            <ul className="checklist">
              {todo.map((t) => (
                <li key={t.text}>
                  <span className={`check-dot${t.done ? ' done' : ''}`}><Icon name="check" size={16} /></span>
                  <span style={t.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{t.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card stack">
          <div className="stack-sm">
            <h2>הלינק האישי שלך</h2>
            <p className="muted">לקוחות שנכנסות אליו רואות את התורים הפנויים ומזמינות לבד.</p>
          </div>
          <ShareLink slug={business.slug} businessName={business.name} />
        </section>

        <section className="card notice" style={{ border: 'none' }}>
          <Icon name="clock" />
          <p>היומן, הבקשות הממתינות לאישור והקליטה הידנית של תורים יופיעו כאן בשלב הבא.</p>
        </section>

        <h2 style={{ marginBlockStart: '0.5rem' }}>הגדרות</h2>
        {sections.map((s) => (
          <details key={s.key} className="card section">
            <summary>
              {s.title}
              <Icon name="chevron" size={20} />
            </summary>
            {s.body}
          </details>
        ))}
      </main>

      {savedMsg && (
        <div role="status" className="tag success" style={{ position: 'fixed', bottom: 20, insetInline: 0, margin: '0 auto', width: 'fit-content', padding: '0.6rem 1.2rem', fontSize: '0.95rem', boxShadow: 'var(--shadow)' }}>
          <Icon name="check" size={18} />
          {savedMsg}
        </div>
      )}
    </>
  );
}
