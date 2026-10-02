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
    const centerName = org?.name || 'مركز المهندس للخدمات العلمية والطباعة';
    const phone = '01127897245';
    const address = 'شارع بورسعيد أمام الإدارة التعليمية الجديدة — شرق مستشفى العدوة المركزي';
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
    // شبكة علامة مائية مكررة على كامل الصفحة
    const wmCells = Array.from({ length: 48 }, () =>
      `<span class="wm-cell">${wmText}<br/><small>${invNo}</small></span>`
    ).join('');

    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>فاتورة مبيعات ${invNo}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
    margin: 0; padding: 0; color: #123055;
    background: #fff;
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 0 0 16px;
    overflow: hidden;
    min-height: 277mm;
  }

  /* علامة مائية مكررة على كل الفاتورة */
  .watermark {
    position: absolute;
    inset: 0;
    z-index: 50;
    pointer-events: none;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 88px;
    align-items: center;
    justify-items: center;
    opacity: 1;
    overflow: hidden;
  }
  .wm-cell {
    transform: rotate(-30deg);
    font-size: 16px;
    font-weight: 900;
    color: rgba(13, 58, 122, 0.22);
    text-align: center;
    line-height: 1.4;
    user-select: none;
    white-space: nowrap;
  }
  .wm-cell small {
    display: inline-block;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 800;
    color: rgba(13, 58, 122, 0.24);
    letter-spacing: 0.4px;
  }
  .content { position: relative; z-index: 1; }

  /* هيدر مطابق لهوية المركز */
  .hero {
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, #eef5ff 0%, #ffffff 70%);
    padding: 0 0 8px;
    border-bottom: 3px solid #1a4f9c;
  }
  .hero-bg-left {
    position: absolute;
    top: -30px; right: -40px;
    width: 200px; height: 180px;
    background: radial-gradient(circle at 30% 40%, #1a4f9c 0%, #0d2f66 60%, transparent 70%);
    border-radius: 50%;
    opacity: 0.95;
  }
  .hero-bg-right {
    position: absolute;
    top: -20px; left: -50px;
    width: 190px; height: 170px;
    background: radial-gradient(circle at 70% 40%, #1a4f9c 0%, #0a2558 65%, transparent 72%);
    border-radius: 50%;
    opacity: 0.95;
  }
  .hero-inner {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 110px 1fr 120px;
    gap: 8px;
    align-items: center;
    padding: 14px 16px 10px;
  }
  .hero-art {
    text-align: center;
    font-size: 28px;
    line-height: 1.2;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.12));
  }
  .hero-art .row { letter-spacing: 2px; }
  .hero-brand { text-align: center; }
  .hero-brand h1 {
    margin: 0;
    font-size: 30px;
    color: #0a2f6e;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .hero-brand .sub {
    margin: 4px 0 0;
    font-size: 13px;
    color: #1a4f9c;
    font-weight: 800;
  }
  .hero-brand .addr {
    margin: 5px 0 0;
    font-size: 11px;
    color: #3d5f8c;
    font-weight: 600;
  }
  .hero-brand .phone {
    margin: 4px 0 0;
    font-size: 13px;
    color: #0d2f66;
    font-weight: 800;
  }
  .hero-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .hero-logo {
    width: 58px; height: 58px;
    border-radius: 50%;
    background: linear-gradient(145deg, #0d3a7a, #1a4f9c);
    border: 3px solid #e8a317;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    box-shadow: 0 3px 10px rgba(13,47,102,.3);
  }
  .svc-tags {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
  }
  .svc-tags span {
    display: block;
    background: #0d2f66;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    text-align: center;
    padding: 3px 4px;
    border-radius: 4px;
    border-right: 3px solid #e8a317;
  }

  .body-pad { padding: 12px 16px 0; }

  .title-wrap { text-align: center; margin: 2px 0 12px; }
  .title-wrap .title {
    display: inline-block;
    background: linear-gradient(135deg, #1a4f9c, #0d2f66);
    color: #fff;
    font-size: 16px;
    font-weight: 900;
    padding: 7px 42px;
    border-radius: 24px;
    border: 2px solid #e8a317;
    box-shadow: 0 2px 0 #0a2558;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 14px;
    margin-bottom: 12px;
    font-size: 12.5px;
  }
  .meta .field {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1.5px solid #9eb6d8;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(255,255,255,0.9);
    min-height: 34px;
  }
  .meta .field label {
    background: #1a4f9c;
    color: #fff;
    font-weight: 800;
    font-size: 11px;
    padding: 8px 10px;
    white-space: nowrap;
    min-width: 78px;
    text-align: center;
  }
  .meta .field span {
    flex: 1;
    padding: 6px 10px;
    font-weight: 700;
    color: #0d2f66;
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    margin-bottom: 12px;
    background: rgba(255,255,255,0.88);
  }
  table.items th, table.items td {
    border: 1px solid #9eb6d8;
    padding: 7px 6px;
    text-align: center;
  }
  table.items th { color: #fff; font-weight: 800; }
  table.items th.col-n { background: #e89b1a; width: 34px; }
  table.items th.col-name { background: #1a4f9c; text-align: right; }
  table.items th.col-qty { background: #1e9e6a; width: 68px; }
  table.items th.col-price { background: #5b4fcf; width: 88px; }
  table.items th.col-total { background: #d6455d; width: 92px; }
  table.items td.num { background: #fff7e8; font-weight: 700; color: #b87a0c; }
  table.items td:nth-child(2) { text-align: right; }
  table.items tbody tr { height: 27px; }

  .bottom {
    display: grid;
    grid-template-columns: 1.15fr 0.95fr;
    gap: 12px;
  }
  .notes, .totals {
    border: 1.5px solid #9eb6d8;
    border-radius: 8px;
    padding: 10px 12px;
    background: rgba(247, 250, 255, 0.92);
    min-height: 88px;
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
  .notes .lines { border-bottom: 1px dotted #9eb6d8; height: 20px; margin: 4px 0; }
  .totals table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .totals td { padding: 5px 8px; border-bottom: 1px solid #d0dff2; }
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
    margin: 16px 0 8px;
    font-weight: 800;
    color: #0d3a7a;
    font-size: 14px;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin: 0 16px;
    padding: 8px 4px;
    border-top: 2px solid #1a4f9c;
    font-size: 11px;
    color: #355a8c;
  }
  .bottom-wave {
    height: 6px;
    margin-top: 10px;
    background: linear-gradient(90deg, #0a2a5c 0%, #1a4f9c 40%, #e8a317 70%, #0a2a5c 100%);
  }
  .auth-strip {
    text-align: center;
    font-size: 9px;
    color: #7a8fa8;
    margin: 6px 16px 0;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { max-width: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="watermark" aria-hidden="true">${wmCells}</div>
    <div class="content">
      <div class="hero">
        <div class="hero-bg-left"></div>
        <div class="hero-bg-right"></div>
        <div class="hero-inner">
          <div class="hero-art" aria-hidden="true">
            <div class="row">📚🖨️</div>
            <div class="row">💻✏️📐</div>
          </div>
          <div class="hero-brand">
            <h1>مركز المهندس</h1>
            <p class="sub">للخدمات العلمية والطباعة والأدوات المكتبية</p>
            <p class="addr">${escapeHtml(address)}</p>
            <p class="phone">تليفون / واتساب: <span dir="ltr">${escapeHtml(phone)}</span></p>
          </div>
          <div class="hero-side">
            <div class="hero-logo">🎓</div>
            <div class="svc-tags">
              <span>خدمات علمية</span>
              <span>تصوير وطباعة</span>
              <span>أدوات مكتبية</span>
            </div>
          </div>
        </div>
      </div>

      <div class="body-pad">
        <div class="title-wrap"><span class="title">فاتورة مبيعات</span></div>

        <div class="meta">
          <div class="field"><label>اسم العميل</label><span>${customer}</span></div>
          <div class="field"><label>التاريخ</label><span>${escapeHtml(dateStr)}</span></div>
          <div class="field"><label>رقم الهاتف</label><span dir="ltr">—</span></div>
          <div class="field"><label>رقم الفاتورة</label><span dir="ltr">${invNo}</span></div>
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

        <p class="thanks">— شكرًا لثقتكم بنا —</p>
      </div>

      <div class="footer">
        <span>${escapeHtml(centerName)}</span>
        <span dir="ltr">${escapeHtml(phone)}</span>
      </div>
      <div class="auth-strip">وثيقة إلكترونية — ${invNo} — العلامة المائية المكررة جزء من الحماية ضد التزوير</div>
      <div class="bottom-wave"></div>
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
