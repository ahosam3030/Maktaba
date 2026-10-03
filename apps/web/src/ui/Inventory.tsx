import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../data/api';

type InventoryItem = {
  id: string;
  name: string;
  barcode?: string | null;
  unit: string;
  piecesPerPack: number;
  currentCost: number;
  salePrice: number;
  purchased: number;
  returned: number;
  sold: number;
  adjusted: number;
  stock: number;
};

const qty = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
const money = (n: number) =>
  `${n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('جرد فعلي');
  const [notes, setNotes] = useState('');
  const [pageTab, setPageTab] = useState<'balances' | 'adjust' | 'edit'>('balances');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // edit form
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editSale, setEditSale] = useState('');
  const [editPpp, setEditPpp] = useState('1');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<InventoryItem[]>('/inventory');
      setItems(result);
      setProductId((current) =>
        current && result.some((item) => item.id === current) ? current : result[0]?.id || '',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المخزون.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.barcode || '').toLowerCase().includes(q),
    );
  }, [items, query]);

  const totals = useMemo(() => {
    const units = items.reduce((s, i) => s + i.stock, 0);
    const negative = items.filter((i) => i.stock < 0).length;
    const value = items.reduce((s, i) => s + Math.max(0, i.stock) * (Number(i.currentCost) || 0), 0);
    return { units, negative, value, count: items.length };
  }, [items]);

  function startEdit(item: InventoryItem) {
    setEditId(item.id);
    setEditName(item.name);
    setEditBarcode(item.barcode || '');
    setEditCost(String(item.currentCost ?? 0));
    setEditSale(String(item.salePrice ?? 0));
    setEditPpp(String(item.piecesPerPack || 1));
    setNotice(`تعديل «${item.name}»`);
  }

  function cancelEdit() {
    setEditId(null);
    setNotice('');
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setNotice('');
    try {
      await apiRequest(`/inventory/products/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          barcode: editBarcode.trim(),
          currentCost: Number(editCost),
          salePrice: Number(editSale),
          piecesPerPack: Number(editPpp),
        }),
      });
      setNotice('تم حفظ بيانات الصنف.');
      setEditId(null);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حفظ الصنف.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(item: InventoryItem) {
    if (
      !confirm(
        `حذف الصنف «${item.name}»؟\nيُسمح فقط إن لم يكن مربوطًا بفواتير وارد/مبيعات/مرتجعات.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/inventory/products/${item.id}`, { method: 'DELETE' });
      setNotice(`تم حذف «${item.name}».`);
      if (editId === item.id) setEditId(null);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حذف الصنف.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAdjustment() {
    const amount = Number(quantity);
    if (!productId || !Number.isFinite(amount) || amount === 0 || !reason.trim()) {
      setNotice('اختر الصنف وأدخل كمية تعديل غير صفرية وسببًا.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest('/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          quantity: amount,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      setNotice('تم حفظ تسوية الجرد.');
      setQuantity('');
      setNotes('');
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حفظ التسوية.');
    } finally {
      setBusy(false);
    }
  }

  async function repairBalances() {
    if (
      !confirm(
        'إصلاح الأرصدة: حذف تسويات «حذف فاتورة وارد» القديمة التي كانت تخصم المخزون مرتين؟',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ deletedMovements: number }>(
        '/inventory/repair-purchase-delete-adjustments',
        { method: 'POST', body: '{}' },
      );
      setNotice(`تم إصلاح الأرصدة. حركات محذوفة: ${res.deletedMovements}`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر إصلاح الأرصدة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">إدارة الأصناف</span>
          <h1>المخزون</h1>
          <p>الرصيد = وارد − مرتجعات − مبيعات ± تسويات. مرتبط بفواتير الوارد على الخادم.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="secondary-btn" type="button" disabled={busy} onClick={() => void repairBalances()}>
            إصلاح الأرصدة
          </button>
          <button className="secondary-btn" type="button" onClick={() => void refresh()}>
            تحديث البيانات
          </button>
        </div>
      </div>

      {notice && (
        <div className="purchase-notice" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="purchase-notice" role="alert">
          {error}
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card"><div className="label">عدد الأصناف</div><div className="value">{totals.count}</div></div>
        <div className="stat-card"><div className="label">إجمالي الرصيد (قطعة)</div><div className={`value ${totals.units < 0 ? 'negative' : ''}`}>{qty(totals.units)}</div></div>
        <div className="stat-card"><div className="label">أصناف رصيدها سالب</div><div className={`value ${totals.negative ? 'negative' : ''}`}>{totals.negative}</div></div>
        <div className="stat-card"><div className="label">قيمة المخزون (تكلفة)</div><div className="value">{money(totals.value)}</div></div>
      </div>

      <div className="page-tabs" role="tablist">
        <button type="button" className={pageTab === 'balances' ? 'active' : ''} onClick={() => setPageTab('balances')}>أرصدة الأصناف</button>
        <button type="button" className={pageTab === 'adjust' ? 'active' : ''} onClick={() => setPageTab('adjust')}>تسوية جرد</button>
      </div>

      {editId && (
        <section className="purchase-panel">
          <div className="panel-heading">
            <div>
              <h2>تعديل صنف</h2>
              <p>الاسم، الباركود، التكلفة، وسعر البيع.</p>
            </div>
            <button className="secondary-btn small" type="button" onClick={cancelEdit}>
              إلغاء
            </button>
          </div>
          <div className="inline-form" style={{ flexWrap: 'wrap' }}>
            <label>
              الاسم
              <input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label>
              الباركود
              <input value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} dir="ltr" />
            </label>
            <label>
              تكلفة القطعة
              <input type="number" min="0" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} />
            </label>
            <label>
              سعر البيع
              <input type="number" min="0" step="0.01" value={editSale} onChange={(e) => setEditSale(e.target.value)} />
            </label>
            <label>
              قطع / عبوة
              <input type="number" min="1" step="1" value={editPpp} onChange={(e) => setEditPpp(e.target.value)} />
            </label>
            <button className="primary-btn" type="button" disabled={busy} onClick={() => void saveEdit()}>
              حفظ الصنف
            </button>
          </div>
        </section>
      )}

      {pageTab === 'adjust' && (
      <section className="purchase-panel">
        <div className="panel-heading">
          <div>
            <h2>تسوية جرد</h2>
            <p>كمية موجبة تزيد الرصيد وسالبة تنقصه (بالقطعة).</p>
          </div>
        </div>
        <div className="inline-form">
          <label>
            الصنف
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">اختر الصنف</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — الرصيد {qty(item.stock)}
                </option>
              ))}
            </select>
          </label>
          <label>
            كمية التعديل
            <input
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="مثال: 5 أو -2"
            />
          </label>
          <label>
            سبب التعديل
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="جرد فعلي / تالف" />
          </label>
          <label>
            ملاحظات
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
          </label>
          <button className="primary-btn" type="button" disabled={busy} onClick={() => void saveAdjustment()}>
            حفظ التسوية
          </button>
        </div>
      </section>

      )}

      {pageTab === 'balances' && (
      <section className="purchase-panel">
        <div className="panel-heading">
          <div>
            <h2>أرصدة الأصناف</h2>
            <p>الوارد من فواتير المشتريات على الخادم. يمكنك التعديل أو الحذف من الإجراءات.</p>
          </div>
          <span className="count-badge">{filtered.length}</span>
        </div>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم الصنف أو الباركود"
        />
        {loading ? (
          <div className="empty-state">جارٍ تحميل المخزون...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الباركود</th>
                  <th>الوارد</th>
                  <th>المرتجع</th>
                  <th>المباع</th>
                  <th>تسويات</th>
                  <th>الرصيد</th>
                  <th>التكلفة</th>
                  <th>سعر البيع</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td dir="ltr">{item.barcode || '—'}</td>
                    <td>{qty(item.purchased)}</td>
                    <td>{qty(item.returned)}</td>
                    <td>{qty(item.sold)}</td>
                    <td>{qty(item.adjusted)}</td>
                    <td>
                      <strong style={{ color: item.stock < 0 ? '#b42318' : '#0a7a4b' }}>
                        {qty(item.stock)}
                      </strong>
                    </td>
                    <td>{money(item.currentCost)}</td>
                    <td>{money(item.salePrice)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="secondary-btn small" type="button" onClick={() => startEdit(item)}>
                          تعديل
                        </button>
                        <button
                          className="danger-outline-btn"
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteProduct(item)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">لا توجد أصناف. سجّل فاتورة وارد من المشتريات أولًا.</div>
            )}
          </div>
        )}
      </section>

      <p className="purchase-footnote">
        إذا ظهر رصيد سالب بعد حذف فواتير وارد قديمة، اضغط «إصلاح الأرصدة» مرة واحدة. المبيعات تبقى مخصومة من
        الرصيد بشكل طبيعي.
      </p>
    </div>
  );
}
