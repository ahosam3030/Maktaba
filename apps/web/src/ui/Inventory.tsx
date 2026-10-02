import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../data/api';

type InventoryItem = { id: string; name: string; barcode?: string | null; unit: string; piecesPerPack: number; currentCost: number; salePrice: number; purchased: number; returned: number; sold: number; adjusted: number; stock: number };
const qty = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
const money = (n: number) => `${n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('جرد فعلي');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [salePriceEdit, setSalePriceEdit] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await apiRequest<InventoryItem[]>('/inventory');
      setItems(result);
      setProductId((current) => current && result.some((item) => item.id === current) ? current : result[0]?.id || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل المخزون.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function saveSalePrice() {
    const price = Number(salePriceEdit);
    if (!productId || !Number.isFinite(price) || price < 0) { setNotice('اختر الصنف وأدخل سعر بيع صحيح.'); return; }
    try {
      await apiRequest(`/inventory/products/${productId}`, { method: 'PATCH', body: JSON.stringify({ salePrice: price }) });
      setNotice('تم تحديث سعر البيع.'); setSalePriceEdit(''); await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر تحديث سعر البيع.'); }
  }

  async function saveAdjustment() {
    const amount = Number(quantity);
    if (!productId || !Number.isFinite(amount) || amount === 0 || !reason.trim()) { setNotice('اختر الصنف وأدخل كمية تعديل غير صفرية وسبب التعديل.'); return; }
    try {
      await apiRequest('/inventory/adjustments', { method: 'POST', body: JSON.stringify({ productId, quantity: amount, reason: reason.trim(), notes: notes.trim() || undefined }) });
      setNotice('تم حفظ حركة التسوية.'); setQuantity(''); setNotes(''); await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر حفظ التسوية.'); }
  }

  const filtered = items.filter((item) => `${item.name} ${item.barcode || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const totalUnits = items.reduce((sum, item) => sum + item.stock, 0);
  return <div className="purchases-page">
    <div className="purchase-title"><div><span className="eyebrow">إدارة الأصناف</span><h1>المخزون</h1><p>الرصيد محسوب من فواتير الوارد والمرتجعات وتسويات الجرد المسجلة على الخادم.</p></div><button className="secondary-btn" onClick={() => void refresh()}>تحديث البيانات</button></div>
    {notice && <div className="purchase-notice" role="status">{notice}</div>}
    {error && <div className="purchase-notice" role="alert">{error} — تأكد من تسجيل الدخول وتشغيل الخادم.</div>}
    <section className="stats-grid"><article className="stat-card"><span>عدد الأصناف</span><strong>{items.length}</strong></article><article className="stat-card"><span>إجمالي الرصيد بالوحدات الأساسية</span><strong>{qty(totalUnits)}</strong></article><article className="stat-card"><span>أصناف رصيدها صفر أو أقل</span><strong>{items.filter((item) => item.stock <= 0).length}</strong></article></section>
    <section className="purchase-panel"><div className="panel-heading"><div><h2>تسوية جرد</h2><p>الكمية الموجبة تزيد الرصيد والسالبة تخصم منه. تُسجّل بالوحدة الأساسية (قطعة).</p></div></div>
      <div className="inline-form"><label>الصنف<select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">اختر الصنف</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} — الرصيد {qty(item.stock)}</option>)}</select></label><label>كمية التعديل<input type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="مثال: 5 أو -2" /></label><label>سبب التعديل<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="جرد فعلي / تالف / تسوية" /></label><label>ملاحظات<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" /></label><button className="primary-btn" onClick={() => void saveAdjustment()}>حفظ التسوية</button></div>
      <div className="inline-form" style={{marginTop:12}}><label>سعر البيع (للصنف المحدد)<input type="number" min="0" step="0.01" value={salePriceEdit} onChange={(e)=>setSalePriceEdit(e.target.value)} placeholder="0.00" /></label><button className="secondary-btn" type="button" onClick={() => void saveSalePrice()}>تحديث سعر البيع</button></div>
    </section>
    <section className="purchase-panel"><div className="panel-heading"><div><h2>أرصدة الأصناف</h2><p>تُعرض بيانات المكتبة المسجّل دخولها فقط.</p></div><span className="count-badge">{filtered.length}</span></div><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم الصنف أو الباركود" />
      {loading ? <div className="empty-state">جارٍ تحميل المخزون...</div> : <div className="table-wrap"><table><thead><tr><th>الصنف</th><th>الباركود</th><th>الوارد (قطعة)</th><th>المرتجع (قطعة)</th><th>المباع (قطعة)</th><th>تسويات الجرد</th><th>الرصيد الحالي</th><th>آخر تكلفة</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{item.name}</td><td dir="ltr">{item.barcode || '—'}</td><td>{qty(item.purchased)}</td><td>{qty(item.returned)}</td><td>{qty(item.sold)}</td><td>{qty(item.adjusted)}</td><td><strong>{qty(item.stock)}</strong></td><td>{money(item.currentCost)}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">لا توجد أصناف لعرضها. سجّل فواتير وارد بعد تسجيل الدخول أولًا.</div>}</div>}
    </section>
    <p className="purchase-footnote">تنبيه: هذه شاشة أولية للمخزون. لم تُربط شاشة فواتير الوارد المحلية بالخادم بعد؛ لذلك لن تظهر الفواتير المحفوظة في المتصفح هنا تلقائيًا. لا تعتمد عليها في الجرد التجاري قبل إتمام الربط والاختبارات.</p>
  </div>;
}
