import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { cleanSlug, displayPhone, normalizePhone, suggestSlug } from '../../../lib/format';
import type { Business } from '../../../lib/types';
import type { StepProps } from './types';

/** פרטי העסק. בלי business — יוצר את העסק (create_business); עם — מעדכן. */
export default function DetailsStep({ business, onSaved, submitLabel, formId, ownerPhone }: StepProps & { ownerPhone?: string }) {
  const [name, setName] = useState(business?.name ?? '');
  const [slug, setSlug] = useState(business?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(business));
  const [phone, setPhone] = useState(displayPhone(business?.phone ?? ownerPhone));
  const [description, setDescription] = useState(business?.description ?? '');
  const [instagram, setInstagram] = useState(business?.instagram_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fields = {
      name: name.trim(),
      phone: phone ? normalizePhone(phone).slice(1) : null,
      description: description.trim() || null,
      instagram_url: instagram.trim() || null,
    };

    let id = business?.id;
    if (!id) {
      const { data, error } = await supabase.rpc('create_business', {
        p_slug: slug,
        p_name: fields.name,
        p_phone: fields.phone,
      });
      if (error) {
        setBusy(false);
        setError(error.message.includes('duplicate') || error.message.includes('unique')
          ? 'הכתובת הזו כבר תפוסה. אפשר לנסות כתובת אחרת.'
          : 'לא הצלחנו ליצור את העסק. אפשר לנסות שוב.');
        return;
      }
      id = data as string;
    }

    const { data, error } = await supabase.from('businesses').update(fields).eq('id', id).select().single<Business>();
    setBusy(false);
    if (error || !data) setError('השמירה נכשלה. אפשר לנסות שוב.');
    else onSaved(data);
  }

  return (
    <form id={formId} className="stack" onSubmit={submit}>
      <label className="field">
        שם העסק
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(suggestSlug(e.target.value));
          }}
          placeholder="למשל: הציפורניים של ליאת"
          autoFocus={!business}
          required
        />
      </label>

      <label className="field">
        הלינק האישי שלך
        <div className="input-prefix">
          <span>{location.host}/b/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(cleanSlug(e.target.value));
            }}
            placeholder="liat-nails"
            pattern="[a-z0-9-]{2,40}"
            disabled={Boolean(business)}
            required
            aria-describedby="slug-help"
          />
        </div>
        <small id="slug-help">
          {business ? 'הלינק קבוע ולא ניתן לשינוי, כדי שלינקים ששיתפת ימשיכו לעבוד.' : 'אותיות באנגלית, ספרות ומקפים. זה הלינק שתשימי באינסטגרם ובוואטסאפ.'}
        </small>
      </label>

      <label className="field">
        טלפון של העסק
        <input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-1234567" />
      </label>

      <label className="field">
        כמה מילים על העסק <small>(לא חובה)</small>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={400}
          placeholder="למשל: סטודיו קטן ונעים, מתמחה בבניית ציפורניים ובלק ג'ל עמיד"
        />
      </label>

      <label className="field">
        אינסטגרם <small>(לא חובה)</small>
        <input type="url" dir="ltr" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      {submitLabel && <button className="btn" disabled={busy}>{busy ? 'שומרת…' : submitLabel}</button>}
    </form>
  );
}
