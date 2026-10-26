import { useState } from 'react';
import Icon from '../../ui/Icon';

/** הלינק האישי של העסק — לאינסטגרם ולוואטסאפ (אסטרטגיית "קודם כלי לעסק", החלטה 8) */
export default function ShareLink({ slug, businessName }: { slug: string; businessName: string }) {
  const url = `${location.origin}/b/${slug}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('העתיקי את הלינק:', url);
    }
  }

  const waText = encodeURIComponent(`לקביעת תור ב${businessName}, בלחיצה אחת: ${url}`);

  return (
    <div className="stack-sm">
      <div className="link-box">
        <code>{url.replace(/^https?:\/\//, '')}</code>
        <button type="button" className="btn small" onClick={copy} aria-live="polite">
          <Icon name={copied ? 'check' : 'copy'} size={18} />
          {copied ? 'הועתק' : 'העתקה'}
        </button>
      </div>
      <a className="btn secondary block" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">
        <Icon name="chat" size={20} />
        שליחה בוואטסאפ
      </a>
    </div>
  );
}
