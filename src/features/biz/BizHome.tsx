import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Business, OpenHour, Service } from '../../lib/types';
import Brand from '../../ui/Brand';
import Icon from '../../ui/Icon';
import ShareLink from './ShareLink';
import DetailsStep from './steps/DetailsStep';
import LocationStep from './steps/LocationStep';
import ServicesStep from './steps/ServicesStep';
import HoursStep from './steps/HoursStep';
import RulesStep from './steps/RulesStep';
import { createCalendarApi } from './calendar/api';
import CalendarTab from './calendar/CalendarTab';
import RequestsTab from './calendar/RequestsTab';
import { useNow, useRange } from './calendar/parts';
import { zonedIso, addDays, todayKey } from '../book/datetime';

interface Setup {
  services: number;
  hours: number;
  location: boolean;
}

type Tab = 'calendar' | 'requests' | 'settings';

/** מסך הבית של העסק: יומן, בקשות שמחכות לטיפול, והגדרות */
export default function BizHome({ business, onBusiness }: { business: Business; onBusiness: (b: Business) => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<OpenHour[]>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('calendar');
  const [reloadKey, setReloadKey] = useState(0);
  const api = useMemo(() => createCalendarApi(business.id), [business.id]);
  const now = useNow();

  useEffect(() => {
    Promise.all([
      supabase.from('services').select('*').eq('business_id', business.id).eq('active', true).order('sort_order'),
      supabase.from('open_hours').select('*').eq('business_id', business.id).order('weekday').order('opens'),
    ]).then(([s, h]) => {
      setServices((s.data ?? []) as Service[]);
      setHours((h.data ?? []) as OpenHour[]);
      setSetup({ services: s.data?.length ?? 0, hours: h.data?.length ?? 0, location: Boolean(business.city) });
    });
  }, [business, reloadKey]);

  // בקשות וערעורים: חודש אחורה (סימון הגעה, ערעורים) וחודש קדימה (בקשות)
  const today = todayKey();
  const requests = useRange(api, zonedIso(addDays(today, -30), '00:00'), zonedIso(addDays(today, 31), '00:00'),
    () => toast('נכנסה הזמנה חדשה'));
  const pendingCount = (requests.bookings ?? []).filter((b) => b.status === 'pending').length;

  function toast(msg: string) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2500);
  }

  const saved = (label: string) => (b: Business) => {
    onBusiness(b);
    setReloadKey((k) => k + 1);
    toast(`${label} נשמרו`);
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

      <main className={`page stack${tab === 'calendar' ? ' wide-cal' : ''}`}>
        <div className="row between wrap" style={{ gap: '0.5rem' }}>
          <div className="stack-sm" style={{ gap: 0 }}>
            <h1 style={{ fontSize: '1.4rem' }}>{business.name}</h1>
            <span className="muted">{business.status === 'listed' ? 'מופיע בחיפוש' : 'הלינק האישי פעיל'}</span>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="ניהול העסק">
          {([['calendar', 'יומן'], ['requests', 'בקשות'], ['settings', 'הגדרות']] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              {label}
              {key === 'requests' && pendingCount > 0 && <span className="count-badge" aria-label={`${pendingCount} ממתינות`}>{pendingCount}</span>}
            </button>
          ))}
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
            {tab !== 'settings' && <button className="btn secondary small" style={{ alignSelf: 'flex-start' }} onClick={() => setTab('settings')}>להגדרות</button>}
          </section>
        )}

        {tab === 'calendar' && <CalendarTab api={api} services={services} hours={hours} />}
        {tab === 'requests' && <RequestsTab api={api} bookings={requests.bookings} services={services} hours={hours} now={now} />}
        {tab === 'settings' && (
          <>
            <section className="card stack">
              <div className="stack-sm">
                <h2>הלינק האישי שלך</h2>
                <p className="muted">לקוחות שנכנסות אליו רואות את התורים הפנויים ומזמינות לבד.</p>
              </div>
              <ShareLink slug={business.slug} businessName={business.name} />
            </section>
            {sections.map((s) => (
              <details key={s.key} className="card section">
                <summary>
                  {s.title}
                  <Icon name="chevron" size={20} />
                </summary>
                {s.body}
              </details>
            ))}
          </>
        )}
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
