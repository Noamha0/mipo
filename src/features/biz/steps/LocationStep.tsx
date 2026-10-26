import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { DEFAULT_CITY } from '../../../lib/config';
import type { AddressMode, Business, BusinessPrivate } from '../../../lib/types';
import Icon from '../../../ui/Icon';
import type { StepProps } from './types';

/**
 * מיקום (החלטה 15): סטודיו — הכתובת ציבורית. מהבית — בפרופיל רק עיר ושכונה,
 * והכתובת המלאה (business_private) נחשפת ללקוחה רק אחרי שהתור אושר.
 */
export default function LocationStep({ business, onSaved, submitLabel, formId }: StepProps) {
  const b = business!;
  const [mode, setMode] = useState<AddressMode>(b.address_mode);
  const [city, setCity] = useState(b.city ?? DEFAULT_CITY);
  const [neighborhood, setNeighborhood] = useState(b.neighborhood ?? '');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('business_private')
      .select('*')
      .eq('business_id', b.id)
      .maybeSingle<BusinessPrivate>()
      .then(({ data }) => {
        if (!data) return;
        setStreet(data.street ?? '');
        setHouse(data.house_number ?? '');
        setNotes(data.entrance_notes ?? '');
      });
  }, [b.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fullStreet = [street.trim(), house.trim()].filter(Boolean).join(' ');

    const priv = await supabase
      .from('business_private')
      .update({ street: street.trim() || null, house_number: house.trim() || null, entrance_notes: notes.trim() || null })
      .eq('business_id', b.id);
    const pub = await supabase
      .from('businesses')
      .update({
        address_mode: mode,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        street_public: mode === 'studio' ? fullStreet || null : null,
      })
      .eq('id', b.id)
      .select()
      .single<Business>();
    setBusy(false);
    if (priv.error || pub.error || !pub.data) setError('השמירה נכשלה. אפשר לנסות שוב.');
    else onSaved(pub.data);
  }

  return (
    <form id={formId} className="stack" onSubmit={submit}>
      <div className="stack-sm">
        <span className="field">איפה מקבלים לקוחות?</span>
        <div className="seg" role="group" aria-label="סוג המקום">
          <button type="button" aria-pressed={mode === 'studio'} onClick={() => setMode('studio')}>
            <span className="row" style={{ justifyContent: 'center', gap: '0.4rem' }}><Icon name="studio" size={20} />סטודיו / מספרה</span>
          </button>
          <button type="button" aria-pressed={mode === 'home'} onClick={() => setMode('home')}>
            <span className="row" style={{ justifyContent: 'center', gap: '0.4rem' }}><Icon name="home" size={20} />מהבית</span>
          </button>
        </div>
      </div>

      <div className="notice">
        <Icon name="pin" />
        <p>
          {mode === 'home'
            ? 'בפרופיל יופיעו רק העיר והשכונה. הכתובת המלאה תישלח ללקוחה רק אחרי שהתור שלה אושר.'
            : 'הכתובת המלאה תופיע בפרופיל לכל מי שמחפשת.'}
        </p>
      </div>

      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          עיר
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label className="field" style={{ flex: 1 }}>
          שכונה
          <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="למשל: גבעת המורה" />
        </label>
      </div>

      <div className="row">
        <label className="field" style={{ flex: 3 }}>
          רחוב
          <input value={street} onChange={(e) => setStreet(e.target.value)} required />
        </label>
        <label className="field" style={{ flex: 1 }}>
          מספר
          <input value={house} onChange={(e) => setHouse(e.target.value)} inputMode="numeric" />
        </label>
      </div>

      <label className="field">
        הוראות הגעה <small>(לא חובה, יישלח רק עם אישור התור)</small>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="למשל: כניסה מהחצר, קומה 2" />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      {submitLabel && <button className="btn" disabled={busy}>{busy ? 'שומרת…' : submitLabel}</button>}
    </form>
  );
}
