import { useEffect, useState } from 'react';
import { apiRequest } from '../data/api';

type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  salePrice?: number | string;
  unit?: string | null;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function Labels() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');
  const [cols, setCols] = useState(3);
  const [showPrice, setShowPrice] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiRequest<Product[]>('/inventory');
        setProducts(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : 'تعذر تحميل الأصناف');
      }
    })();
  }, []);

  const filtered = products.filter((p) => {
    const s = `${p.name} ${p.barcode || ''}`.toLowerCase();
    return !q.trim() || s.includes(q.trim().toLowerCase());
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function setQty(id: string, n: number) {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, Math.min(50, n || 1)) }));
  }

  function printLabels() {
    const items: Array<Product & { copies: number }> = [];
    for (const p of products) {
      const copies = selected[p.id];
      if (!copies) continue;
      if (!p.barcode?.trim()) {
        setNotice(`الصنف «${p.name}» بدون باركود — تخطّيه أو أضف باركودًا.`);
        continue;
      }
      items.push({ ...p, copies });
    }
    if (items.length === 0) {
      setNotice('اختر أصنافًا لها باركود.');
      return;
    }
    const labelsHtml = items
      .flatMap((p) =>
        Array.from({ length: p.copies }, () => {
          const price = Number(p.salePrice) || 0;
          return `<div class="label">
  <div class="name">${escapeHtml(p.name)}</div>
  ${showPrice ? `<div class="price">${price.toFixed(2)} ج.م</div>` : ''}
  <svg class="bc" data-barcode="${escapeHtml(p.barcode || '')}"></svg>
  <div class="code" dir="ltr">${escapeHtml(p.barcode || '')}</div>
</div>`;
        }),
      )
      .join('\n');

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      setNotice('اسمح بالنوافذ المنبثقة للطباعة.');
      return;
    }
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>ملصقات باركود</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  @page { margin: 6mm; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 0; }
  .sheet { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 4mm; padding: 4mm; }
  .label {
    border: 1px dashed #94a3b8;
    border-radius: 4px;
    padding: 3mm 2mm;
    text-align: center;
    page-break-inside: avoid;
    min-height: 28mm;
  }
  .name { font-size: 11px; font-weight: 700; margin-bottom: 2px; line-height: 1.3; }
  .price { font-size: 12px; font-weight: 800; color: #0f766e; margin: 2px 0; }
  .code { font-size: 10px; letter-spacing: 0.04em; margin-top: 2px; }
  svg.bc { max-width: 100%; height: 36px; }
</style></head><body>
<div class="sheet">${labelsHtml}</div>
<script>
  document.querySelectorAll('svg.bc').forEach(function(el) {
    var code = el.getAttribute('data-barcode') || '';
    if (!code) return;
    try {
      JsBarcode(el, code, { format: 'CODE128', width: 1.4, height: 36, displayValue: false, margin: 0 });
    } catch (e) {}
  });
  window.onload = function() { setTimeout(function(){ window.print(); }, 300); };
<\/script>
</body></html>`);
    w.document.close();
    setNotice(`جاهز للطباعة: ${items.reduce((s, i) => s + i.copies, 0)} ملصق.`);
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>ملصقات الباركود</h2>
          <p className="muted-sm">اختر الأصناف واطبع ملصقات للرف أو العبوة (CODE128).</p>
        </div>
        <button type="button" className="primary-btn" onClick={printLabels}>
          طباعة الملصقات
        </button>
      </div>
      {notice && (
        <p className="feedback" role="status">
          {notice}
        </p>
      )}
      <div className="filter-bar">
        <label className="grow">
          بحث
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم أو باركود" />
        </label>
        <label>
          أعمدة الصفحة
          <select value={cols} onChange={(e) => setCols(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
          إظهار السعر
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>الصنف</th>
              <th>الباركود</th>
              <th>السعر</th>
              <th>عدد الملصقات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[p.id])}
                    onChange={() => toggle(p.id)}
                    disabled={!p.barcode}
                  />
                </td>
                <td>{p.name}</td>
                <td dir="ltr">{p.barcode || '—'}</td>
                <td>{Number(p.salePrice || 0).toFixed(2)}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    style={{ width: 70 }}
                    disabled={!selected[p.id]}
                    value={selected[p.id] || 1}
                    onChange={(e) => setQty(p.id, Number(e.target.value))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
