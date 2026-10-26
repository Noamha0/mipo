import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDuration, formatPrice } from '../../lib/format';
import { dayLabel, timeLabel } from './datetime';
import type { Business, Service } from '../../lib/types';
import Icon from '../../ui/Icon';

interface Props {
  business: Business;
  services: Service[];
  slotStart: string;
  totalDuration: number;
  totalPrice: number;
  onBack: () => void;
  onBooked: (status: string) => void;
}

// קודי שגיאה מה-RPC → נוסח ללקוחה
const ERRORS: Record<string, string> = {
  authentication_required: 'כדי לאשר תור צריך להתחבר. במצב ההדגמה הנוכחי ההתחברות מנוטרלת, אז השמירה לא תושלם — אבל כל שאר הזרימה עובדת.',
  phone_required: 'חסר מספר טלפון מאומת לחשבון.',
  slot_unavailable: 'המשבצת הזו כבר נתפסה. אפשר לחזור ולבחור שעה אחרת.',
  business_not_found: 'העסק לא נמצא.',
  invalid_services: 'אחד השירותים כבר לא זמין. כדאי לבחור מחדש.',
};

/** סיכום ואישור. ההזמנה עצמה דרך create_booking RPC (דורש התחברות אמיתית). */
export default function Confirm({ business, services, slotStart, totalDuration, totalPrice, onBack, onBooked }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('create_booking', {
      p_business_id: business.id,
      p_service_ids: services.map((s) => s.id),
      p_start: slotStart,
      p_name: name.trim() || null,
    });
    setBusy(false);
    if (error) {
      const code = (error.message || '').match(/[a-z_]+/)?.[0] ?? '';
      setError(ERRORS[code] ?? 'לא הצלחנו לקבוע את התור. אפשר לנסות שוב.');
      return;
    }
    onBooked((data as { status?: string } | null)?.status ?? 'pending');
  }

  return (
    <form className="stack" onSubmit={confirm}>
      <button type="button" className="btn ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        חזרה למועדים
      </button>

      <section className="card stack-sm">
        <h3>סיכום התור</h3>
        <div className="row between"><span className="muted">מתי</span><b>{dayLabel(slotStart)}, {timeLabel(slotStart)}</b></div>
        <hr className="divider" />
        {services.map((s) => (
          <div key={s.id} className="row between">
            <span>{s.name}</span>
            <span className="muted">{formatDuration(s.duration_min)} · {formatPrice(s.price)}</span>
          </div>
        ))}
        <hr className="divider" />
        <div className="row between">
          <b>סה״כ</b>
          <b>{formatDuration(totalDuration)}{totalPrice > 0 ? ` · ${formatPrice(totalPrice)}` : ''}</b>
        </div>
      </section>

      <label className="field">
        השם שלך
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="איך לקרוא לך?" autoComplete="name" />
      </label>

      <button className="btn block" disabled={busy}>
        <Icon name="check" size={20} />
        {busy ? 'קובעת…' : 'אישור התור'}
      </button>

      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
