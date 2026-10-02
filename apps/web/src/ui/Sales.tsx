import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../data/api';

type Product = { id: string; name: string; barcode?: string | null; salePrice: number; currentCost: number; stock: number };
type CartLine = { productId: string; quantity: string; unitPrice: string };
type Sale = {
  id: string; invoiceNumber: string; saleDate: string; customerName?: string | null;
  subtotal: number | string; discount: number | string; total: number | string; paidAmount: number | string;
  items: Array<{ id: string; productName: string; quantity: number | string; unitPrice: number | string; lineTotal: number | string }>;
};
const money = (n: number) => `${n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
const qty = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState(`S-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [stock, records] = await Promise.all([apiRequest<Product[]>('/inventory'), apiRequest<Sale[]>('/sales')]);
      setProducts(stock); setSales(records);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات المبيعات.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filteredProducts = products.filter((p) => `${p.name} ${p.barcode || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0), 0), [cart]);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  function addProduct(product: Product) {
    setNotice('');
    if (product.stock <= 0) { setNotice('الصنف رصيده غير كافٍ للبيع.'); return; }
    setCart((old) => {
      const found = old.find((line) => line.productId === product.id);
      if (found) return old.map((line) => line.productId === product.id ? { ...line, quantity: String(Math.min(product.stock, (Number(line.quantity) || 0) + 1)) } : line);
      return [...old, { productId: product.id, quantity: '1', unitPrice: String(product.salePrice || 0) }];
    });
  }

  function printSale(sale: Sale) {
    const w = window.open('', '_blank');
    if (!w) { setNotice('اسمح بالنوافذ المنبثقة لطباعة الفاتورة.'); return; }
    const rows = (sale.items || []).map((l) =>
      `<tr><td>${escapeHtml(l.productName)}</td><td>${Number(l.quantity)}</td><td>${money(Number(l.unitPrice))}</td><td>${money(Number(l.lineTotal))}</td></tr>`
    ).join('');
    const paid = Number(sale.paidAmount);
    const tot = Number(sale.total);
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${escapeHtml(sale.invoiceNumber)}</title>
<style>
body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111;max-width:800px;margin:0 auto}
h1{text-align:center;font-size:22px;margin:0 0 8px}
.sub{text-align:center;color:#444;margin-bottom:16px}
.line{border-top:1px dashed #888;margin:14px 0}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #bbb;padding:8px;text-align:right;font-size:13px}
th{background:#eee}
.totals{margin-top:16px;width:280px;margin-right:auto}
.totals div{display:flex;justify-content:space-between;padding:4px 0}
.grand{font-weight:bold;font-size:16px}
@media print{body{padding:8px}}
</style></head><body>
<h1>فاتورة مبيعات</h1>
<div class="sub">رقم الفاتورة: ${escapeHtml(sale.invoiceNumber)}</div>
<p>التاريخ: ${escapeHtml(new Date(sale.saleDate).toLocaleString('ar-EG'))}</p>
<p>العميل: ${escapeHtml(sale.customerName || 'عميل نقدي')}</p>
<div class="line"></div>
<table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="totals">
<div><span>قبل الخصم</span><b>${money(Number(sale.subtotal))}</b></div>
<div><span>الخصم</span><b>${money(Number(sale.discount))}</b></div>
<div class="grand"><span>الإجمالي</span><b>${money(tot)}</b></div>
<div><span>المدفوع</span><b>${money(paid)}</b></div>
<div><span>المتبقي</span><b>${money(Math.max(0, tot - paid))}</b></div>
</div>
<div class="line"></div>
<p style="text-align:center">شكرًا لتعاملكم</p>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
    w.document.close();
  }

  async function saveSale(andPrint = false) {
    if (!invoiceNumber.trim() || cart.length === 0) { setNotice('أدخل رقم الفاتورة وأضف صنفًا واحدًا على الأقل.'); return; }
    if (discountValue > subtotal) { setNotice('الخصم لا يمكن أن يتجاوز إجمالي الفاتورة.'); return; }
    const paid = paidAmount.trim() === '' ? total : Number(paidAmount);
    if (!Number.isFinite(paid) || paid < 0 || paid > total) { setNotice('المبلغ المدفوع يجب أن يكون بين صفر وإجمالي الفاتورة.'); return; }
    setSaving(true); setNotice('');
    try {
      const sale = await apiRequest<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          customerName: customerName.trim() || undefined,
          discount: discountValue,
          paidAmount: paid,
          items: cart.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
        }),
      });
      setNotice(`تم حفظ فاتورة البيع ${sale.invoiceNumber} بنجاح.`);
      setCart([]); setCustomerName(''); setDiscount('0'); setPaidAmount('');
      setInvoiceNumber(`S-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`);
      await refresh();
      if (andPrint) printSale(sale);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر حفظ فاتورة البيع.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div><span className="eyebrow">نقطة البيع</span><h1>المبيعات</h1><p>إنشاء فاتورة بيع، خصم الرصيد من المخزون، ومتابعة الفواتير السابقة.</p></div>
        <button className="secondary-btn" type="button" onClick={() => void refresh()}>تحديث البيانات</button>
      </div>
      {notice && <div className="purchase-notice" role="status">{notice}</div>}
      {error && <div className="purchase-notice" role="alert">{error} — تأكد من تسجيل الدخول وتشغيل الخادم.</div>}

      <section className="stats-grid">
        <article className="stat-card"><span>عدد فواتير البيع المعروضة</span><strong>{sales.length}</strong></article>
        <article className="stat-card"><span>إجمالي قيمة الفواتير</span><strong>{money(sales.reduce((sum, sale) => sum + Number(sale.total), 0))}</strong></article>
        <article className="stat-card"><span>المبالغ المتبقية</span><strong>{money(sales.reduce((sum, sale) => sum + Number(sale.total) - Number(sale.paidAmount), 0))}</strong></article>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>فاتورة بيع جديدة</h2><p>تُحفظ الفاتورة على الخادم وتُسجل حركة خصم للمخزون.</p></div></div>
        <div className="purchase-form-grid">
          <label>رقم الفاتورة<input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></label>
          <label>اسم العميل (اختياري)<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="عميل نقدي" /></label>
          <label>بحث عن صنف أو باركود<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اكتب اسم الصنف أو امسح الباركود" /></label>
        </div>
        <div className="product-chips">{filteredProducts.filter((p) => p.stock > 0).slice(0, 16).map((p) => (
          <button key={p.id} type="button" onClick={() => addProduct(p)}>{p.name} · المتاح {qty(p.stock)}</button>
        ))}</div>
        <div className="table-wrap">
          <table className="purchase-table">
            <thead><tr><th>الصنف</th><th>المتاح</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
              {cart.map((line) => {
                const p = products.find((item) => item.id === line.productId);
                return (
                  <tr key={line.productId}>
                    <td>{p?.name || 'صنف'}</td>
                    <td>{qty(p?.stock || 0)}</td>
                    <td><input aria-label="الكمية" type="number" min="0.001" step="0.001" max={p?.stock || 0} value={line.quantity} onChange={(e) => setCart((old) => old.map((x) => x.productId === line.productId ? { ...x, quantity: e.target.value } : x))} /></td>
                    <td><input aria-label="سعر البيع" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => setCart((old) => old.map((x) => x.productId === line.productId ? { ...x, unitPrice: e.target.value } : x))} /></td>
                    <td>{money(Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0))}</td>
                    <td><button className="icon-btn" type="button" aria-label="حذف الصنف" onClick={() => setCart((old) => old.filter((x) => x.productId !== line.productId))}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cart.length === 0 && <div className="empty-state">اختر صنفًا من القائمة لإضافته إلى الفاتورة.</div>}
        </div>
        <div className="invoice-bottom">
          <div className="purchase-form-grid sale-payment-fields">
            <label>الخصم بالجنيه<input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
            <label>المدفوع الآن<input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={String(total)} /></label>
          </div>
          <div className="totals-box">
            <div><span>الإجمالي قبل الخصم</span><b>{money(subtotal)}</b></div>
            <div><span>الخصم</span><b>{money(discountValue)}</b></div>
            <div className="grand-total"><span>الصافي</span><b>{money(total)}</b></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="primary-btn" type="button" disabled={saving || cart.length === 0} onClick={() => void saveSale(false)}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ فاتورة البيع'}
            </button>
            <button className="secondary-btn" type="button" disabled={saving || cart.length === 0} onClick={() => void saveSale(true)}>
              حفظ وطباعة
            </button>
          </div>
        </div>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>سجل فواتير البيع</h2><p>أحدث 300 فاتورة محفوظة على الخادم.</p></div></div>
        {loading ? <div className="empty-state">جارٍ تحميل الفواتير...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>التاريخ</th>
                  <th>العميل</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>طباعة</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.invoiceNumber}</td>
                    <td>{new Date(sale.saleDate).toLocaleDateString('ar-EG')}</td>
                    <td>{sale.customerName || 'عميل نقدي'}</td>
                    <td>{money(Number(sale.total))}</td>
                    <td>{money(Number(sale.paidAmount))}</td>
                    <td>{money(Number(sale.total) - Number(sale.paidAmount))}</td>
                    <td>
                      <button className="secondary-btn small" type="button" onClick={() => printSale(sale)}>طباعة</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sales.length === 0 && <div className="empty-state">لا توجد فواتير بيع حتى الآن.</div>}
          </div>
        )}
      </section>
    </div>
  );
}
