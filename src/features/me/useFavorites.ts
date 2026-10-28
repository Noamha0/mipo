import { useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { meApi } from './api';

// מאגר אחד לכל הלבבות בעמוד (כרטיסים, דף עסק, "המועדפים שלי"), נטען פעם אחת למשתמש
let ids = new Set<string>();
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useFavorites() {
  const { session } = useSession();
  const nav = useNavigate();
  const uid = session?.user.id ?? null;
  const snapshot = useSyncExternalStore(subscribe, () => ids);

  useEffect(() => {
    if (uid === loadedFor) return;
    loadedFor = uid;
    if (!uid) { ids = new Set(); emit(); return; }
    meApi.favoriteIds().then((list) => { ids = new Set(list); emit(); }).catch(() => {});
  }, [uid]);

  async function toggle(businessId: string) {
    if (!uid) { nav('/me?tab=favorites'); return; }
    const was = ids.has(businessId);
    ids = new Set(ids);
    if (was) ids.delete(businessId); else ids.add(businessId);
    emit(); // מיד, ואם השרת נכשל — מחזירים
    try {
      const on = await meApi.toggleFavorite(businessId);
      if (on === was) { ids = new Set(ids); if (on) ids.add(businessId); else ids.delete(businessId); emit(); }
    } catch {
      ids = new Set(ids);
      if (was) ids.add(businessId); else ids.delete(businessId);
      emit();
    }
  }

  return { isFavorite: (id: string) => snapshot.has(id), toggle };
}
