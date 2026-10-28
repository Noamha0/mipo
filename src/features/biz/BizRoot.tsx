import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Business } from '../../lib/types';
import { DEV_BYPASS, useSession } from '../auth/useSession';
import PhoneLogin from '../auth/PhoneLogin';
import Wizard from './Wizard';
import BizHome from './BizHome';

/** צד העסק: כניסה → (אשף הקמה אם אין עסק) → מסך הבית */
export default function BizRoot() {
  const { session, loading } = useSession();
  // התוצאה נשמרת יחד עם ה-uid שלה, כך שהחלפת משתמשת לא מציגה עסק של קודמתה
  const [resolved, setResolved] = useState<{ uid: string; business: Business | null } | null>(null);
  const [wizard, setWizard] = useState(false);
  const uid = session?.user.id;

  const resolve = useCallback(async (forUid: string) => {
    // ⚠️ עקיפת DEV: בלי משתמש אמיתי אין חברות בעסק, אז מציגים עסק דמו (קריאה ציבורית)
    // עם יומן בזיכרון. ‎/biz?wizard פותח את אשף ההקמה במקום.
    if (DEV_BYPASS && !new URLSearchParams(location.search).has('wizard')) {
      const { data: demo } = await supabase.from('businesses').select('*').eq('slug', 'mipo-demo-nails').maybeSingle<Business>();
      if (demo) { setResolved({ uid: forUid, business: demo }); return; }
    }
    const { data: m } = await supabase.from('business_members').select('business_id').limit(1).maybeSingle();
    if (!m) {
      setResolved({ uid: forUid, business: null });
      setWizard(true);
      return;
    }
    const { data: b } = await supabase.from('businesses').select('*').eq('id', m.business_id).single<Business>();
    setResolved({ uid: forUid, business: b ?? null });
  }, []);

  useEffect(() => {
    if (uid) void resolve(uid);
  }, [uid, resolve]);

  // undefined = עוד לא נבדק; null = למשתמשת אין עסק
  const business = resolved && resolved.uid === uid ? resolved.business : undefined;
  const setBusiness = (b: Business) => uid && setResolved({ uid, business: b });

  if (loading) return <Loading />;
  if (!session) {
    return <PhoneLogin title="כניסה לעסקים" subtitle="ניהול תורים בלי התכתבויות. נכנסים עם הטלפון, בלי סיסמה." />;
  }
  if (business === undefined) return <Loading />;

  if (wizard || !business) {
    return (
      <Wizard
        business={business}
        ownerPhone={session.user.phone}
        onBusiness={setBusiness}
        onDone={() => setWizard(false)}
      />
    );
  }
  return <BizHome business={business} onBusiness={setBusiness} />;
}

function Loading() {
  return (
    <main className="center-card">
      <p className="muted" role="status">טוענת…</p>
    </main>
  );
}
