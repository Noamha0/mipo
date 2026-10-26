import type { IconName } from '../ui/Icon';

/**
 * תחומים (sectors) — האריחים בדף הבית. כל תחום מאגד כמה קבוצות קטגוריות
 * (category_groups) מהקטלוג. הקבוצות החדשות (home/pros/wellness/pets/family)
 * נוספות במיגרציה 0002; תחום שאין לו עדיין עסקים פשוט מציג "אין תוצאות".
 */
export interface Sector {
  key: string;
  name: string;
  groups: string[];
  icon: IconName;
  tint: string;  // רקע האריח
  ink: string;   // צבע האייקון
}

export const SECTORS: Sector[] = [
  { key: 'beauty',  name: 'יופי וטיפוח',  groups: ['nails', 'makeup', 'brows', 'cosmetics'], icon: 'lotus',    tint: '#fde8f0', ink: '#c2185b' },
  { key: 'hair',    name: 'מספרות',       groups: ['hair'],                                   icon: 'scissors', tint: '#e3f2fd', ink: '#1565c0' },
  { key: 'fitness', name: 'כושר וספורט',  groups: ['fitness'],                                icon: 'dumbbell', tint: '#fdeee6', ink: '#d84315' },
  { key: 'home',    name: 'שירותי בית',   groups: ['home'],                                   icon: 'house',    tint: '#fdf6e3', ink: '#a1670b' },
  { key: 'pros',    name: 'בעלי מקצוע',   groups: ['pros'],                                   icon: 'wrench',   tint: '#eeeafd', ink: '#5b3fc4' },
  { key: 'health',  name: 'בריאות וגוף',  groups: ['wellness'],                               icon: 'pulse',    tint: '#e2f7f5', ink: '#0b7f7a' },
  { key: 'pets',    name: 'חיות מחמד',    groups: ['pets'],                                   icon: 'paw',      tint: '#fff0e0', ink: '#b45309' },
  { key: 'family',  name: 'ילדים ולימודים', groups: ['family'],                               icon: 'book',     tint: '#e8f5e9', ink: '#2e7d32' },
];

export const sectorByKey = (key: string | null | undefined) => SECTORS.find((s) => s.key === key) ?? null;

/** התחום שקבוצת קטגוריות שייכת אליו */
export const sectorOfGroup = (groupKey: string) => SECTORS.find((s) => s.groups.includes(groupKey)) ?? null;
