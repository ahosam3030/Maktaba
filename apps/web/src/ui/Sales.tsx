import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getStoredOrganization } from '../data/api';

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
      // تطبيع الأرقام القادمة من الـ API
      setProducts((stock || []).map((p) => ({
        ...p,
        stock: Number(p.stock) || 0,
        salePrice: Number(p.salePrice) || 0,
        currentCost: Number(p.currentCost) || 0,
      })));
      setSales(records || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات المبيعات.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filteredProducts = products.filter((p) => `${p.name} ${p.barcode || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0), 0), [cart]);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  function addProduct(product: Product) {
    const stock = Number(product.stock) || 0;
    if (stock <= 0) {
      setNotice(`«${product.name}» رصيده صفر. سجّل فاتورة وارد من المشتريات أو تسوية مخزون أولًا.`);
      return;
    }
    setCart((old) => {
      const found = old.find((line) => line.productId === product.id);
      if (found) {
        const nextQty = Math.min(stock, (Number(found.quantity) || 0) + 1);
        return old.map((line) => line.productId === product.id ? { ...line, quantity: String(nextQty) } : line);
      }
      return [...old, {
        productId: product.id,
        quantity: '1',
        unitPrice: String(Number(product.salePrice) || 0),
      }];
    });
    setNotice(`تمت إضافة «${product.name}» إلى الفاتورة.`);
  }

  function printSale(sale: Sale) {
    const w = window.open('', '_blank');
    if (!w) { setNotice('اسمح بالنوافذ المنبثقة لطباعة الفاتورة.'); return; }
    const org = getStoredOrganization();
    const centerName = org?.name || 'مركز المهندس للخدمات العلمية والطباعة وأدوات مكتبية';
    const phone = '01127897245';
    const address = 'المركز المركزي عدوة — أمام ديعسوب شارع / مستشفى شرق الجديدة — الإدارة التعليمية';
    const items = sale.items || [];
    const maxRows = Math.max(10, items.length);
    const rows = Array.from({ length: maxRows }, (_, i) => {
      const l = items[i];
      if (!l) {
        return `<tr><td class="num">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`;
      }
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(l.productName)}</td>
        <td>${qty(Number(l.quantity))}</td>
        <td>${Number(l.unitPrice).toFixed(2)}</td>
        <td>${Number(l.lineTotal).toFixed(2)}</td>
      </tr>`;
    }).join('');
    const paid = Number(sale.paidAmount);
    const tot = Number(sale.total);
    const sub = Number(sale.subtotal);
    const disc = Number(sale.discount);
    const dateStr = new Date(sale.saleDate).toLocaleDateString('ar-EG');
    const invNo = escapeHtml(sale.invoiceNumber);
    const customer = escapeHtml(sale.customerName || 'عميل نقدي');
    const wmText = escapeHtml(centerName);

    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>فاتورة مبيعات ${invNo}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
    margin: 0; padding: 0; color: #0f2744;
    background: #fff;
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 12px 16px 20px;
    overflow: hidden;
    min-height: 270mm;
  }
  /* علامة مائية — يصعب تزوير الفاتورة بدونها */
  .watermark {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  .watermark span {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 42px;
    font-weight: 800;
    color: rgba(15, 55, 120, 0.07);
    white-space: nowrap;
    letter-spacing: 2px;
    user-select: none;
  }
  .watermark .wm-code {
    top: 62%;
    font-size: 22px;
    color: rgba(15, 55, 120, 0.09);
    font-weight: 700;
  }
  .content { position: relative; z-index: 1; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 3px solid #1a4f9c;
  }
  .brand {
    text-align: center;
    flex: 1;
  }
  .brand .badge {
    display: inline-block;
    background: linear-gradient(135deg, #f5b942, #e89b1a);
    color: #1a2a4a;
    font-weight: 800;
    font-size: 13px;
    padding: 4px 18px;
    border-radius: 20px;
    margin-bottom: 6px;
  }
  .brand h1 {
    margin: 0;
    font-size: 26px;
    color: #1a4f9c;
    font-weight: 900;
    line-height: 1.3;
  }
  .brand .sub {
    margin: 4px 0 0;
    font-size: 13px;
    color: #2a5a9e;
    font-weight: 700;
  }
  .logo-box {
    width: 72px; height: 72px;
    border-radius: 16px;
    background: linear-gradient(145deg, #1a4f9c, #0d2f66);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 900;
    box-shadow: 0 4px 12px rgba(26,79,156,.25);
  }

  .contact-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    justify-content: center;
    align-items: center;
    background: linear-gradient(90deg, #0d2f66, #1a4f9c, #0d2f66);
    color: #fff;
    padding: 8px 12px;
    border-radius: 8px;
    margin: 12px 0 14px;
    font-size: 12px;
  }
  .contact-bar span { white-space: nowrap; }

  .title-wrap { text-align: center; margin: 8px 0 14px; }
  .title-wrap .title {
    display: inline-block;
    background: linear-gradient(135deg, #f5b942, #e89b1a);
    color: #1a2a4a;
    font-size: 18px;
    font-weight: 900;
    padding: 6px 36px;
    border-radius: 24px;
    border: 2px solid #c98912;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 20px;
    border: 1px solid #c5d4ea;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 12px;
    background: #f7faff;
    font-size: 13px;
  }
  .meta div { display: flex; gap: 6px; }
  .meta strong { color: #1a4f9c; min-width: 90px; }

  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    margin-bottom: 12px;
  }
  table.items th, table.items td {
    border: 1px solid #9eb6d8;
    padding: 7px 6px;
    text-align: center;
  }
  table.items th {
    color: #fff;
    font-weight: 800;
  }
  table.items th.col-n { background: #e89b1a; width: 36px; }
  table.items th.col-name { background: #1a4f9c; text-align: right; }
  table.items th.col-qty { background: #1e9e6a; width: 70px; }
  table.items th.col-price { background: #6b4fd6; width: 90px; }
  table.items th.col-total { background: #d6455d; width: 95px; }
  table.items td.num { background: #fff7e8; font-weight: 700; color: #c98912; }
  table.items td:nth-child(2) { text-align: right; }
  table.items tbody tr { height: 28px; }

  .bottom {
    display: grid;
    grid-template-columns: 1.2fr 0.9fr;
    gap: 12px;
    margin-top: 4px;
  }
  .notes, .totals {
    border: 1px solid #9eb6d8;
    border-radius: 10px;
    padding: 10px 12px;
    background: #f7faff;
    min-height: 90px;
  }
  .notes h3 {
    margin: 0 0 8px;
    display: inline-block;
    background: #e89b1a;
    color: #1a2a4a;
    font-size: 12px;
    padding: 3px 12px;
    border-radius: 12px;
  }
  .notes .lines { border-bottom: 1px dotted #9eb6d8; height: 22px; margin: 4px 0; }
  .totals table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .totals td { padding: 6px 8px; border-bottom: 1px solid #d0dff2; }
  .totals td:last-child { text-align: left; font-weight: 700; direction: ltr; }
  .totals tr.grand td {
    background: #e8f0ff;
    font-weight: 900;
    color: #0d2f66;
    font-size: 14px;
    border-bottom: none;
  }

  .thanks {
    text-align: center;
    margin-top: 18px;
    font-weight: 800;
    color: #1a4f9c;
    font-size: 14px;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 2px solid #1a4f9c;
    font-size: 11px;
    color: #355a8c;
  }
  .auth-strip {
    margin-top: 8px;
    text-align: center;
    font-size: 10px;
    color: #6a7f9c;
    letter-spacing: 0.5px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { max-width: none; padding: 0; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="watermark" aria-hidden="true">
      <span>${wmText}</span>
      <span class="wm-code">${invNo}</span>
    </div>
    <div class="content">
      <div class="header">
        <div class="logo-box">م</div>
        <div class="brand">
          <div class="badge">مركز</div>
          <h1>${escapeHtml(centerName.split(' لل')[0] || 'المهندس')}</h1>
          <p class="sub">للخدمات العلمية والطباعة وأدوات مكتبية</p>
        </div>
        <div class="logo-box" style="background:linear-gradient(145deg,#e89b1a,#c98912)">📚</div>
      </div>

      <div class="contact-bar">
        <span>📞 تليفون: ${escapeHtml(phone)}</span>
        <span>📍 ${escapeHtml(address)}</span>
      </div>

      <div class="title-wrap"><span class="title">فاتورة مبيعات</span></div>

      <div class="meta">
        <div><strong>رقم الفاتورة:</strong> <span dir="ltr">${invNo}</span></div>
        <div><strong>التاريخ:</strong> ${escapeHtml(dateStr)}</div>
        <div style="grid-column:1/-1"><strong>اسم العميل:</strong> ${customer}</div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="col-n">م</th>
            <th class="col-name">اسم الصنف</th>
            <th class="col-qty">الكمية</th>
            <th class="col-price">سعر الوحدة</th>
            <th class="col-total">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="bottom">
        <div class="notes">
          <h3>ملاحظات</h3>
          <div class="lines"></div>
          <div class="lines"></div>
          <div class="lines"></div>
        </div>
        <div class="totals">
          <table>
            <tr><td>إجمالي المبلغ</td><td>${sub.toFixed(2)}</td></tr>
            <tr><td>خصم</td><td>${disc.toFixed(2)}</td></tr>
            <tr class="grand"><td>صافي المبلغ</td><td>${tot.toFixed(2)}</td></tr>
            <tr><td>المدفوع</td><td>${paid.toFixed(2)}</td></tr>
            <tr><td>المتبقي</td><td>${Math.max(0, tot - paid).toFixed(2)}</td></tr>
          </table>
        </div>
      </div>

      <p class="thanks">شكرًا لثقتكم بنا</p>
      <div class="footer">
        <span>${escapeHtml(centerName)}</span>
        <span dir="ltr">${escapeHtml(phone)}</span>
      </div>
      <div class="auth-strip">وثيقة صادرة من النظام — ${invNo} — غير صالحة بدون العلامة المائية ورقم الفاتورة</div>
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`);
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

        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table className="purchase-table">
            <thead>
              <tr>
                <th>الأصناف المتاحة للبيع</th>
                <th>الرصيد</th>
                <th>سعر البيع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, 30).map((p) => {
                const stock = Number(p.stock) || 0;
                return (
                  <tr key={p.id}>
                    <td>{p.name}{p.barcode ? ` · ${p.barcode}` : ''}</td>
                    <td>{qty(stock)}</td>
                    <td>{money(Number(p.salePrice) || 0)}</td>
                    <td>
                      <button
                        className="primary-btn small"
                        type="button"
                        disabled={stock <= 0}
                        onClick={() => addProduct(p)}
                      >
                        {stock <= 0 ? 'لا رصيد' : 'إضافة'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="empty-state">
              {products.length === 0
                ? 'لا توجد أصناف. سجّل فاتورة وارد من شاشة المشتريات أولًا.'
                : 'لا نتائج لهذا البحث.'}
            </div>
          )}
        </div>

        <div className="panel-heading" style={{ marginTop: 8 }}>
          <div><h2 style={{ fontSize: 16 }}>أصناف الفاتورة</h2></div>
          <span className="count-badge">{cart.length}</span>
        </div>
        <div className="table-wrap">
          <table className="purchase-table">
            <thead><tr><th>الصنف</th><th>المتاح</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>
              {cart.map((line) => {
                const p = products.find((item) => item.id === line.productId);
                const stock = Number(p?.stock) || 0;
                return (
                  <tr key={line.productId}>
                    <td>{p?.name || 'صنف'}</td>
                    <td>{qty(stock)}</td>
                    <td>
                      <input
                        aria-label="الكمية"
                        type="number"
                        min="0.001"
                        step="0.001"
                        max={stock || undefined}
                        value={line.quantity}
                        onChange={(e) => setCart((old) => old.map((x) => x.productId === line.productId ? { ...x, quantity: e.target.value } : x))}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="سعر البيع"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => setCart((old) => old.map((x) => x.productId === line.productId ? { ...x, unitPrice: e.target.value } : x))}
                      />
                    </td>
                    <td>{money(Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0))}</td>
                    <td>
                      <button className="icon-btn" type="button" aria-label="حذف الصنف" onClick={() => setCart((old) => old.filter((x) => x.productId !== line.productId))}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cart.length === 0 && <div className="empty-state">اضغط «إضافة» بجانب الصنف لنقله إلى الفاتورة.</div>}
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
            <button className="primary-btn" type="button" disabled={saving} onClick={() => void saveSale(false)}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ فاتورة البيع'}
            </button>
            <button className="secondary-btn" type="button" disabled={saving} onClick={() => void saveSale(true)}>
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
