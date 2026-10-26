import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/format';
import Brand from '../../ui/Brand';

/** כניסה בטלפון + קוד בסמס. משותף לבעלת העסק (כאן) וללקוחה (אבן דרך 4). */
export default function PhoneLogin({ title, subtitle }: { title: string; subtitle: string }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone) });
    setBusy(false);
    if (error) setError('לא הצלחנו לשלוח קוד. כדאי לבדוק את המספר ולנסות שוב.');
    else setStage('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: code.trim(),
      type: 'sms',
    });
    setBusy(false);
    if (error) setError('הקוד לא נכון או שפג תוקפו. אפשר לנסות שוב.');
    // הצלחה: onAuthStateChange ב-useSession מעביר מסך
  }

  return (
    <main className="center-card stack">
      <Brand />
      <div className="stack-sm">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
      {stage === 'phone' ? (
        <form className="stack" onSubmit={sendCode}>
          <label className="field">
            מספר טלפון נייד
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="050-1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button className="btn block" disabled={busy || phone.replace(/\D/g, '').length < 9}>
            {busy ? 'שולחת…' : 'שלחו לי קוד בסמס'}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <p className="muted">
            שלחנו קוד בן 6 ספרות ל־<span className="ltr">{phone}</span>
          </p>
          <label className="field">
            קוד אימות
            <input
              className="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          </label>
          <button className="btn block" disabled={busy || code.length < 6}>
            {busy ? 'בודקת…' : 'כניסה'}
          </button>
          <button type="button" className="btn ghost" onClick={() => { setStage('phone'); setCode(''); }}>
            החלפת מספר
          </button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
