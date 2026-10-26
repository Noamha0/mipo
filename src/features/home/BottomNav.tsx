import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../../ui/Icon';

type Tab = 'home' | 'search' | 'appointments' | 'biz';

const items: { key: Tab; label: string; to: string; icon: IconName }[] = [
  { key: 'home', label: 'בית', to: '/', icon: 'home' },
  { key: 'search', label: 'חיפוש', to: '/search', icon: 'search' },
  { key: 'appointments', label: 'התורים שלי', to: '/search', icon: 'calendar' },
  { key: 'biz', label: 'לעסקים', to: '/biz', icon: 'studio' },
];

/** ניווט תחתון צף — מובייל בלבד (בדסקטופ הניווט בכותרת). "התורים שלי" נבנה באבן דרך 4. */
export default function BottomNav({ active }: { active: Tab }) {
  const nav = useNavigate();
  return (
    <nav className="bottom-nav" aria-label="ניווט">
      {items.map((it) => (
        <button key={it.key} onClick={() => nav(it.to)} aria-current={it.key === active ? 'page' : undefined}>
          <Icon name={it.icon} size={22} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}
