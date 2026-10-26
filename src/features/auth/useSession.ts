import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// ⚠️ פיתוח בלבד — עוקף את מסך ההתחברות כדי לעבוד על האפליקציה בלי OTP.
// פעיל רק ב-dev (import.meta.env.DEV), אז לעולם לא יחול ב-build לפרודקשן.
// להתחברות אמיתית: שנה ל-false (או מחק את הקבוע ואת הבלוק המסומן ב-useEffect).
const DEV_SKIP_AUTH = true;

const DEV_SESSION = {
  access_token: 'dev-no-auth',
  refresh_token: 'dev-no-auth',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
    phone: '972501234567',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
} as unknown as Session;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⚠️ עוקף DEV — ראה DEV_SKIP_AUTH למעלה. מחק בלוק זה להתחברות אמיתית.
    if (import.meta.env.DEV && DEV_SKIP_AUTH) {
      setSession(DEV_SESSION);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
