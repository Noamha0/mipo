import type { ReactNode } from 'react';
import { LEGAL, LEGAL_DRAFT } from '../../lib/config';
import SiteFooter from '../../ui/SiteFooter';
import SiteHeader from '../../ui/SiteHeader';

/** מסגרת לדפי מידע ומשפט: כותרת, תאריך עדכון, ותוכן קריא ברוחב טקסט */
export default function LegalPage({ title, children, dated = true }: { title: string; children: ReactNode; dated?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className="page legal" style={{ paddingTop: '1.5rem' }}>
        {LEGAL_DRAFT && dated && (
          <p className="notice warn" role="note">טיוטה: הנוסח ממתין לבדיקת עורך דין ולהשלמת פרטי הגוף המפעיל.</p>
        )}
        <h1>{title}</h1>
        {dated && <p className="muted">עודכן לאחרונה: {LEGAL.updated}</p>}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
