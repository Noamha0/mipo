import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

/** שורת החיפוש הראשית: מה מחפשים + איפה. שולחת ל-/search עם הפרמטרים. */
export default function SearchCard({
  cities,
  initialQ = '',
  initialCity = '',
  sector,
}: {
  cities: string[];
  initialQ?: string;
  initialCity?: string;
  sector?: string | null;
}) {
  const nav = useNavigate();
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (city) p.set('city', city);
    if (sector) p.set('sector', sector);
    nav(`/search${p.size ? `?${p}` : ''}`);
  }

  return (
    <form className="search-card" role="search" onSubmit={submit}>
      <label className="search-field">
        <Icon name="search" size={20} />
        <span className="sr-only">מה מחפשים</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חפשו שירות, בעל מקצוע או עסק…" />
      </label>
      <label className="search-field">
        <Icon name="pin" size={20} />
        <span className="sr-only">איפה</span>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">באזור שלי · כל הערים</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button className="btn">
        <Icon name="search" size={20} />
        חיפוש
      </button>
    </form>
  );
}
