import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatDuration, formatPrice } from '../../../lib/format';
import type { Category, CategoryGroup, Service } from '../../../lib/types';
import Icon from '../../../ui/Icon';
import type { StepProps } from './types';

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15 דק' … 4 שעות

/**
 * שירותים (החלטה 5): כל שירות משויך לקטגוריה מהקטלוג הסגור, עם שם, מחיר ומשך
 * משל העסק. השירותים נשמרים מיד בהוספה; "המשך" רק מוודא שיש לפחות אחד.
 */
export default function ServicesStep({ business, onSaved, submitLabel, formId }: StepProps) {
  const b = business!;
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('category_groups').select('*').order('sort_order'),
      supabase.from('categories').select('*').eq('active', true).order('sort_order'),
      supabase.from('services').select('*').eq('business_id', b.id).order('sort_order').order('created_at'),
    ]).then(([g, c, s]) => {
      setGroups(g.data ?? []);
      setCategories(c.data ?? []);
      setServices(s.data ?? []);
    });
  }, [b.id]);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function pickCategory(c: Category) {
    setCategoryId(c.id);
    setName(c.name);
  }

  async function addService() {
    if (!categoryId || !name.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('services')
      .insert({
        business_id: b.id,
        category_id: categoryId,
        name: name.trim(),
        duration_min: duration,
        price: price === '' ? null : Number(price),
        sort_order: services.length,
      })
      .select()
      .single<Service>();
    setBusy(false);
    if (error || !data) {
      setError('לא הצלחנו להוסיף את השירות. אפשר לנסות שוב.');
      return;
    }
    setServices((s) => [...s, data]);
    setCategoryId(null);
    setName('');
    setPrice('');
  }

  async function toggleActive(s: Service) {
    const { data } = await supabase.from('services').update({ active: !s.active }).eq('id', s.id).select().single<Service>();
    if (data) setServices((list) => list.map((x) => (x.id === s.id ? data : x)));
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את "${s.name}"?`)) return;
    const { error } = await supabase.from('services').delete().eq('id', s.id);
    if (!error) setServices((list) => list.filter((x) => x.id !== s.id));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!services.some((s) => s.active)) {
      setError('צריך לפחות שירות פעיל אחד כדי שאפשר יהיה להזמין תור.');
      return;
    }
    onSaved(b);
  }

  const groupCategories = categories.filter((c) => c.group_key === groupKey);

  return (
    <form id={formId} className="stack" onSubmit={submit}>
      {services.length > 0 && (
        <div className="list card" style={{ padding: '0.25rem 1rem' }}>
          {services.map((s) => (
            <div key={s.id} className={`service-row${s.active ? '' : ' inactive'}`}>
              <div className="meta">
                <b>{s.name}</b>
                <span className="muted">
                  {formatDuration(s.duration_min)} · {formatPrice(s.price)}
                  {s.name !== categoryName.get(s.category_id) && <> · {categoryName.get(s.category_id)}</>}
                </span>
              </div>
              <label className="switch" title={s.active ? 'פעיל' : 'מושבת'}>
                <input type="checkbox" checked={s.active} onChange={() => toggleActive(s)} aria-label={`${s.name} פעיל`} />
                <span />
              </label>
              <button type="button" className="icon-btn danger" onClick={() => remove(s)} aria-label={`מחיקת ${s.name}`}>
                <Icon name="trash" size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <h3>{services.length ? 'הוספת שירות נוסף' : 'איזה שירותים את נותנת?'}</h3>
        <div className="chips" role="group" aria-label="תחום">
          {groups.map((g) => (
            <button
              type="button"
              key={g.key}
              className="chip"
              aria-pressed={groupKey === g.key}
              onClick={() => { setGroupKey(g.key); setCategoryId(null); }}
            >
              {g.name}
            </button>
          ))}
        </div>

        {groupKey && (
          <div className="chips" role="group" aria-label="סוג שירות">
            {groupCategories.map((c) => (
              <button type="button" key={c.id} className="chip" aria-pressed={categoryId === c.id} onClick={() => pickCategory(c)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {categoryId && (
          <div className="stack">
            <label className="field">
              השם שיופיע ללקוחות
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: לק ג'ל רוסי" />
            </label>
            <div className="row">
              <label className="field" style={{ flex: 1 }}>
                משך
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{formatDuration(d)}</option>)}
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                מחיר (₪)
                <input type="number" inputMode="numeric" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="לא חובה" />
              </label>
            </div>
            <button type="button" className="btn secondary" onClick={addService} disabled={busy || !name.trim()}>
              <Icon name="plus" size={20} />
              {busy ? 'מוסיפה…' : 'הוספת השירות'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {submitLabel && <button className="btn" disabled={busy}>{submitLabel}</button>}
    </form>
  );
}
