// אייקונים מצוירים לפרויקט (לא סט גנרי). קו מעוגל 1.75, 24×24.
// בכוונה: חץ "חזרה" מצביע ימינה — ב-RTL החזרה היא ימינה.

export type IconName =
  | 'back' | 'next' | 'check' | 'copy' | 'plus' | 'trash' | 'chevron'
  | 'chat' | 'clock' | 'pin' | 'home' | 'studio' | 'logout' | 'edit'
  | 'search' | 'user' | 'heart' | 'star' | 'calendar' | 'bolt' | 'arrow' | 'menu'
  | 'lotus' | 'scissors' | 'dumbbell' | 'house' | 'wrench' | 'pulse' | 'paw' | 'book' | 'dots';

const paths: Record<IconName, React.ReactNode> = {
  back: <path d="M9 5l7 7-7 7" />,
  next: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copy: (
    <>
      <rect x="8" y="8" width="11" height="12" rx="3" />
      <path d="M5 15.5V7a3 3 0 0 1 3-3h7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7" />
    </>
  ),
  chevron: <path d="M6 9.5l6 6 6-6" />,
  // בועת שיחה עם שלוש נקודות — לשיתוף/פנייה בוואטסאפ, בלי להעתיק לוגו מסחרי
  chat: (
    <>
      <path d="M12 4c4.7 0 8 3.1 8 7s-3.3 7-8 7c-1.1 0-2.1-.2-3-.5L5 19l1-3.6C4.7 14.2 4 12.7 4 11c0-3.9 3.3-7 8-7z" />
      <path d="M8.8 11h.01M12 11h.01M15.2 11h.01" strokeWidth="2.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  home: (
    <>
      <path d="M4.5 11L12 4.5l7.5 6.5" />
      <path d="M6.5 9.5V19h11V9.5" />
      <path d="M10.5 19v-4.5h3V19" />
    </>
  ),
  studio: (
    <>
      <path d="M4 9.5L5.5 5h13L20 9.5" />
      <path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5" />
      <path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  edit: (
    <>
      <path d="M15.5 5.5l3 3L9 18H6v-3z" />
      <path d="M13.5 7.5l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />,
  star: <path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" />,
  calendar: (
    <>
      <rect x="4.5" y="5.5" width="15" height="14" rx="3" />
      <path d="M4.5 10h15M9 3.5v4M15 3.5v4" />
    </>
  ),
  bolt: <path d="M13 3.5L6 13.5h5.5L10.5 20.5 18 10h-5.5z" />,
  arrow: <path d="M19 12H5M11 6l-6 6 6 6" />,
  menu: <path d="M5 7h14M5 12h14M5 17h9" />,

  // ---- אייקוני תחומים: קו + "ניצוץ" עגול קטן, כמו הקרניים של הלוגו ----
  lotus: (
    <>
      <path d="M12 19c-3.5 0-7-2.2-8-6 2.6-.4 5.4.6 8 3.4 2.6-2.8 5.4-3.8 8-3.4-1 3.8-4.5 6-8 6z" />
      <path d="M12 16.4c-1.9-2.2-2.4-5.7-.1-10.4 2.4 4.7 2 8.2.1 10.4z" />
      <path d="M9.3 9.8C7.5 9.4 6.4 9.6 5.4 10M14.7 9.8c1.8-.4 2.9-.2 3.9.2" />
    </>
  ),
  scissors: (
    <>
      <circle cx="7" cy="17" r="2.6" />
      <circle cx="17" cy="17" r="2.6" />
      <path d="M8.9 15.2L17.5 4.5M15.1 15.2L6.5 4.5" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M8 12h8" />
      <rect x="4.6" y="7.5" width="3.4" height="9" rx="1.4" />
      <rect x="16" y="7.5" width="3.4" height="9" rx="1.4" />
      <path d="M3 10v4M21 10v4" />
    </>
  ),
  house: (
    <>
      <path d="M4 11.2L12 4.5l8 6.7" />
      <path d="M6.2 9.6V19.5h11.6V9.6" />
      <path d="M10 19.5v-4.8h4v4.8" />
      <circle cx="17.6" cy="5.4" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.6 6.4a4 4 0 0 0 4.8 5.2l-8.6 8.6a2.1 2.1 0 0 1-3-3l8.6-8.6" />
      <path d="M14.6 6.4a4 4 0 0 1 5-2.4l-2.4 2.4.4 2.4 2.4.4 2.4-2.4" />
    </>
  ),
  pulse: (
    <>
      <path d="M12 19.5s-7.2-4.5-7.2-10A4 4 0 0 1 12 7.1a4 4 0 0 1 7.2 2.4c0 5.5-7.2 10-7.2 10z" />
      <path d="M6.5 12.2h3l1.4-2.4 2.2 4.6 1.4-2.2h3" />
    </>
  ),
  paw: (
    <>
      <path d="M12 12.5c2.6 0 5 2.3 5 4.6 0 1.6-1.2 2.4-2.6 2.4-1 0-1.6-.5-2.4-.5s-1.4.5-2.4.5C8.2 19.5 7 18.7 7 17.1c0-2.3 2.4-4.6 5-4.6z" />
      <ellipse cx="7" cy="10" rx="1.6" ry="2.1" />
      <ellipse cx="10.2" cy="6.6" rx="1.6" ry="2.2" />
      <ellipse cx="13.8" cy="6.6" rx="1.6" ry="2.2" />
      <ellipse cx="17" cy="10" rx="1.6" ry="2.1" />
    </>
  ),
  book: (
    <>
      <path d="M12 7.2C10.3 5.8 7.8 5.2 4.5 5.5v12.2c3.3-.3 5.8.3 7.5 1.7 1.7-1.4 4.2-2 7.5-1.7V5.5c-3.3-.3-5.8.3-7.5 1.7z" />
      <path d="M12 7.2v12.2" />
    </>
  ),
  dots: <path d="M6.5 12h.01M12 12h.01M17.5 12h.01" strokeWidth="3" />,
};

export default function Icon({ name, size = 22, fill }: { name: IconName; size?: number; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
