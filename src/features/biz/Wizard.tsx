import { useState } from 'react';
import type { Business } from '../../lib/types';
import Brand from '../../ui/Brand';
import Icon from '../../ui/Icon';
import ShareLink from './ShareLink';
import DetailsStep from './steps/DetailsStep';
import LocationStep from './steps/LocationStep';
import ServicesStep from './steps/ServicesStep';
import HoursStep from './steps/HoursStep';
import RulesStep from './steps/RulesStep';

const STEPS = [
  { title: 'נעים להכיר', subtitle: 'הפרטים הבסיסיים של העסק. הכול ניתן לשינוי אחר כך.', Comp: DetailsStep },
  { title: 'איפה זה קורה?', subtitle: 'כדי שלקוחות יידעו לאן להגיע.', Comp: LocationStep },
  { title: 'השירותים שלך', subtitle: 'בחרי מהרשימה, ותני לכל שירות שם, משך ומחיר משלך.', Comp: ServicesStep },
  { title: 'שעות פעילות', subtitle: 'רק בשעות האלה יוצגו תורים פנויים.', Comp: HoursStep },
  { title: 'כללי הזמנה', subtitle: 'את מחליטה כמה שליטה את רוצה.', Comp: RulesStep },
];

/** אשף הקמה — 5 שלבים ומסך סיום עם הלינק האישי */
export default function Wizard({
  business,
  ownerPhone,
  onBusiness,
  onDone,
}: {
  business: Business | null;
  ownerPhone?: string;
  onBusiness: (b: Business) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);

  if (step === STEPS.length && business) {
    return (
      <main className="page stack" style={{ paddingTop: '2rem' }}>
        <div className="hero stack" style={{ borderRadius: 'var(--radius)' }}>
          <h1>העסק מוכן לקבל תורים</h1>
          <p className="muted">זה הלינק האישי שלך. שימי אותו בביו של האינסטגרם ושלחי ללקוחות הקבועות. במקום להתכתב, הן יבחרו תור לבד.</p>
        </div>
        <div className="card">
          <ShareLink slug={business.slug} businessName={business.name} />
        </div>
        <button className="btn block" onClick={onDone}>למסך העסק</button>
      </main>
    );
  }

  const { title, subtitle, Comp } = STEPS[step];
  const saved = (b: Business) => {
    onBusiness(b);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="page">
      <div className="wizard-head">
        <div className="row between">
          <Brand />
          <span className="muted">שלב {step + 1} מתוך {STEPS.length}</span>
        </div>
        <div className="stepper" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} />
          ))}
        </div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>

      {step === 0 ? (
        <DetailsStep business={business} ownerPhone={ownerPhone} onSaved={saved} formId="step-form" />
      ) : (
        <Comp business={business} onSaved={saved} formId="step-form" />
      )}

      <div className="wizard-actions">
        <button className="btn" type="submit" form="step-form">
          {step === STEPS.length - 1 ? 'סיום' : 'המשך'}
          <Icon name="next" size={20} />
        </button>
        {step > 0 && (
          <button className="btn ghost" type="button" onClick={() => setStep((s) => s - 1)}>
            <Icon name="back" size={20} />
            חזרה
          </button>
        )}
      </div>
    </main>
  );
}
