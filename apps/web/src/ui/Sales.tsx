import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../data/api';
import { loadInvoiceSettings } from '../data/invoiceSettings';

type Product = { id: string; name: string; barcode?: string | null; salePrice: number; currentCost: number; stock: number };
type CartLine = { key: string; productId: string; query: string; unit: string; quantity: string; unitPrice: string };
const SALE_UNITS = ['قطعة', 'ورقة', 'نسخة', 'علبة', 'دستة', 'كرتونة', 'رزمة', 'خدمة'] as const;
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
  const [invoiceNumber, setInvoiceNumber] = useState('1');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /** أكبر رقم فاتورة + 1 (أرقام فقط من نهاية الرقم أو الرقم كاملًا) */
  function computeNextInvoiceNo(records: Sale[]): string {
    let max = 0;
    for (const s of records) {
      const raw = String(s.invoiceNumber || '').trim();
      const m = raw.match(/(\d+)\s*$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return String(max + 1);
  }

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [stock, records] = await Promise.all([apiRequest<Product[]>('/inventory'), apiRequest<Sale[]>('/sales')]);
      setProducts((stock || []).map((p) => ({
        ...p,
        stock: Number(p.stock) || 0,
        salePrice: Number(p.salePrice) || 0,
        currentCost: Number(p.currentCost) || 0,
      })));
      const list = records || [];
      setSales(list);
      setInvoiceNumber(computeNextInvoiceNo(list));
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات المبيعات.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => {
    if (!line.productId) return sum;
    return sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0);
  }, 0), [cart]);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);
  const paidN = paidAmount.trim() === '' ? total : Math.max(0, Number(paidAmount) || 0);
  const remaining = Math.max(0, total - paidN);

  function newLineKey() {
    return `L-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function addEmptyRow() {
    setCart((old) => [...old, { key: newLineKey(), productId: '', query: '', unit: 'قطعة', quantity: '1', unitPrice: '' }]);
    setNotice('');
  }

  /** مطابقة بالباركود أولًا ثم بالاسم */
  function findProduct(raw: string): Product | undefined {
    const q = raw.trim().toLowerCase();
    if (!q) return undefined;
    const byBarcode = products.find((p) => (p.barcode || '').trim().toLowerCase() === q);
    if (byBarcode) return byBarcode;
    const exactName = products.find((p) => p.name.trim().toLowerCase() === q);
    if (exactName) return exactName;
    const starts = products.filter((p) => p.name.toLowerCase().startsWith(q));
    if (starts.length === 1) return starts[0];
    const contains = products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q));
    if (contains.length === 1) return contains[0];
    return undefined;
  }

  function applyProductToLine(line: CartLine, p: Product | undefined, query: string): CartLine {
    if (!p) {
      return { ...line, productId: '', query };
    }
    const stock = Number(p.stock) || 0;
    if (stock <= 0) {
      setNotice(`«${p.name}» رصيده صفر. سجّل وارد أو تسوية مخزون أولًا.`);
      return { ...line, productId: '', query };
    }
    setNotice('');
    return {
      ...line,
      productId: p.id,
      query: p.name,
      unitPrice: line.unitPrice !== '' ? line.unitPrice : String(Number(p.salePrice) || 0),
      quantity: line.quantity && Number(line.quantity) > 0 ? line.quantity : '1',
      unit: line.unit || 'قطعة',
    };
  }

  function onProductQueryChange(key: string, value: string) {
    setCart((old) => old.map((line) => {
      if (line.key !== key) return line;
      // أثناء الكتابة نحدّث النص؛ المطابقة عند Enter أو blur
      return { ...line, query: value, productId: '' };
    }));
  }

  function resolveProductLine(key: string, value?: string) {
    setCart((old) => old.map((line) => {
      if (line.key !== key) return line;
      const text = value !== undefined ? value : line.query;
      const p = findProduct(text);
      if (!text.trim()) return { ...line, productId: '', query: '' };
      if (!p) {
        setNotice(`لم يُعثر على «${text.trim()}» في المخزون. اكتب الاسم أو امسح الباركود.`);
        return { ...line, productId: '', query: text };
      }
      return applyProductToLine(line, p, text);
    }));
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((old) => old.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setCart((old) => old.filter((line) => line.key !== key));
  }

  function resetForm(nextSales?: Sale[]) {
    setCart([]);
    setCustomerName('');
    setDiscount('0');
    setPaidAmount('');
    setSaleDate(new Date().toISOString().slice(0, 10));
    setInvoiceNumber(computeNextInvoiceNo(nextSales ?? sales));
    setNotice('');
  }

  function printSale(sale: Sale) {
    const w = window.open('', '_blank');
    if (!w) { setNotice('اسمح بالنوافذ المنبثقة لطباعة الفاتورة.'); return; }
    const cfg = loadInvoiceSettings();
    const centerName = cfg.watermarkText || cfg.brandTitle;
    const phone = cfg.phone;
    const address = cfg.address;
    const brandTitle = cfg.brandTitle;
    const brandSubtitle = cfg.brandSubtitle;
    const invoiceTitle = cfg.invoiceTitle;
    const footerText = cfg.footerText;
    const serviceTagsHtml = cfg.serviceTags.map((t) => `<span>${escapeHtml(t)}</span>`).join('');
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
            <h1>${escapeHtml(brandTitle)}</h1>
            <p class="sub">${escapeHtml(brandSubtitle)}</p>
            <p class="addr">${escapeHtml(address)}</p>
            <p class="phone">تليفون / واتساب: <span dir="ltr">${escapeHtml(phone)}</span></p>
          </div>
          <div class="hero-side">
            <div class="hero-logo">🎓</div>
            <div class="svc-tags">${serviceTagsHtml}</div>
          </div>
        </div>
      </div>

      <div class="body-pad">
        <div class="title-wrap"><span class="title">${escapeHtml(invoiceTitle)}</span></div>

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

        <p class="thanks">— ${escapeHtml(footerText)} —</p>
      </div>

      <div class="footer">
        <span>${escapeHtml(brandTitle)}</span>
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
    // اربط الأسماء/الباركود بالصنف قبل الحفظ (لو المستخدم ما ضغطش Enter)
    const resolvedCart = cart.map((line) => {
      if (line.productId || !line.query?.trim()) return line;
      const p = findProduct(line.query);
      if (!p || (Number(p.stock) || 0) <= 0) return line;
      return {
        ...line,
        productId: p.id,
        query: p.name,
        unitPrice: line.unitPrice !== '' ? line.unitPrice : String(Number(p.salePrice) || 0),
      };
    });
    if (resolvedCart !== cart) setCart(resolvedCart);

    const lines = resolvedCart.filter((l) => l.productId && Number(l.quantity) > 0);
    if (lines.length === 0) {
      setNotice('أضف صنفًا واحدًا على الأقل: اكتب الاسم أو امسح الباركود ثم انتظر المطابقة (أو اضغط Enter).');
      return;
    }
    const inv = invoiceNumber.trim() || computeNextInvoiceNo(sales);
    if (!invoiceNumber.trim()) setInvoiceNumber(inv);
    for (const line of lines) {
      const p = products.find((x) => x.id === line.productId);
      const stock = Number(p?.stock) || 0;
      const q = Number(line.quantity) || 0;
      if (!p) { setNotice('صنف غير موجود في المخزون.'); return; }
      if (stock <= 0) {
        setNotice(`«${p.name}» رصيده صفر. سجّل وارد من المشتريات ثم حدّث البيانات.`);
        return;
      }
      if (q > stock) { setNotice(`الكمية المطلوبة من «${p.name}» أكبر من المتاح (${stock}).`); return; }
    }
    if (discountValue > subtotal) { setNotice('الخصم لا يمكن أن يتجاوز إجمالي الفاتورة.'); return; }
    const paid = paidAmount.trim() === '' ? total : Number(paidAmount);
    if (!Number.isFinite(paid) || paid < 0 || paid > total) { setNotice('المبلغ المدفوع يجب أن يكون بين صفر وإجمالي الفاتورة.'); return; }
    setSaving(true); setNotice('');
    try {
      const sale = await apiRequest<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: inv,
          saleDate: saleDate || undefined,
          customerName: customerName.trim() || undefined,
          discount: discountValue,
          paidAmount: paid,
          items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
        }),
      });
      setNotice(`تم حفظ فاتورة البيع ${sale.invoiceNumber} بنجاح.`);
      await refresh();
      if (andPrint) printSale(sale);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر حفظ فاتورة البيع.'); }
    finally { setSaving(false); }
  }

  function printDraft() {
    const lines = cart.filter((l) => l.productId && Number(l.quantity) > 0);
    if (lines.length === 0) { setNotice('أضف أصنافًا قبل الطباعة.'); return; }
    const draft: Sale = {
      id: 'draft',
      invoiceNumber: invoiceNumber.trim() || 'مسودة',
      saleDate: saleDate || new Date().toISOString(),
      customerName: customerName.trim() || 'عميل نقدي',
      subtotal,
      discount: discountValue,
      total,
      paidAmount: paidN,
      items: lines.map((line, i) => {
        const p = products.find((x) => x.id === line.productId);
        const q = Number(line.quantity) || 0;
        const price = Number(line.unitPrice) || 0;
        return {
          id: String(i),
          productName: p?.name || 'صنف',
          quantity: q,
          unitPrice: price,
          lineTotal: q * price,
        };
      }),
    };
    printSale(draft);
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
        <div className="panel-heading">
          <div>
            <h2>فاتورة بيع</h2>
            <p>أضف صفوف الأصناف، حدّد الكمية والسعر، ثم احفظ أو اطبع.</p>
          </div>
        </div>

        <div className="sale-meta-row">
          <label>اسم العميل (اختياري)
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="عميل نقدي" />
          </label>
          <label>التاريخ
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </label>
          <label>رقم الفاتورة (تلقائي)
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              title="يُولَّد بالترتيب تلقائيًا ويمكن تعديله يدويًا"
            />
          </label>
        </div>

        <div className="sale-lines-wrap">
          <table className="sale-lines-table">
            <thead>
              <tr>
                <th>الصنف / الخدمة</th>
                <th>الوحدة</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((line) => {
                const lineTotal = Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0);
                const matched = products.find((p) => p.id === line.productId);
                const matchedStock = matched ? Number(matched.stock) || 0 : 0;
                return (
                  <tr key={line.key}>
                    <td>
                      <input
                        list={`products-list-${line.key}`}
                        aria-label="الصنف أو الباركود"
                        placeholder="اكتب الاسم أو امسح الباركود"
                        value={line.query}
                        onChange={(e) => onProductQueryChange(line.key, e.target.value)}
                        onBlur={(e) => resolveProductLine(line.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            resolveProductLine(line.key, (e.target as HTMLInputElement).value);
                          }
                        }}
                        autoComplete="off"
                        style={{
                          borderColor: line.productId
                            ? (matchedStock > 0 ? '#20a486' : '#d97706')
                            : (line.query.trim() ? '#e8a0a0' : undefined),
                          background: line.productId ? (matchedStock > 0 ? '#f0faf6' : '#fff8eb') : undefined,
                        }}
                      />
                      <datalist id={`products-list-${line.key}`}>
                        {products.map((prod) => (
                          <option
                            key={prod.id}
                            value={prod.name}
                            label={`${prod.name}${prod.barcode ? ` · ${prod.barcode}` : ''} · متاح ${qty(Number(prod.stock) || 0)}`}
                          />
                        ))}
                      </datalist>
                      {line.productId && matched && (
                        <div style={{ fontSize: 11, marginTop: 4, color: matchedStock > 0 ? '#0f766e' : '#b45309' }}>
                          {matchedStock > 0 ? `✓ مربوط · متاح ${qty(matchedStock)}` : `⚠ مربوط لكن الرصيد صفر`}
                        </div>
                      )}
                      {!line.productId && line.query.trim() && (
                        <div style={{ fontSize: 11, marginTop: 4, color: '#b42318' }}>
                          غير مربوط — اضغط Enter أو اختر من القائمة
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        aria-label="الوحدة"
                        value={line.unit || 'قطعة'}
                        onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                      >
                        {SALE_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="الكمية"
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="السعر"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <span className="line-total">
                        {lineTotal ? lineTotal.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : '0'}
                      </span>
                    </td>
                    <td>
                      <button className="danger-outline-btn" type="button" onClick={() => removeLine(line.key)}>حذف</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cart.length === 0 && (
            <div className="empty-state">اضغط «+ إضافة صنف» لإضافة صف في الفاتورة.</div>
          )}
        </div>

        {products.length === 0 && (
          <div className="empty-state">لا توجد أصناف في المخزون. سجّل فاتورة وارد من المشتريات أولًا.</div>
        )}

        <div style={{ marginTop: 12 }}>
          <button className="add-line-btn" type="button" onClick={addEmptyRow}>+ إضافة صنف</button>
        </div>

        <div className="sale-pay-row">
          <div className="sale-pay-fields">
            <label>خصم (ج)
              <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
            <label>المدفوع (ج)
              <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
            </label>
          </div>
          <div className="sale-summary">
            <div>الصافي: <strong>{money(total)}</strong></div>
            <div>المتبقي: <strong>{money(remaining)}</strong></div>
          </div>
        </div>

        <div className="sale-actions">
          <button className="primary-btn" type="button" disabled={saving} onClick={() => void saveSale(false)}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
          </button>
          <button className="primary-btn" type="button" disabled={saving} onClick={() => void saveSale(true)}>
            حفظ وطباعة
          </button>
          <button className="secondary-btn" type="button" onClick={printDraft}>طباعة بدون حفظ</button>
          <button className="secondary-btn" type="button" onClick={resetForm}>فاتورة جديدة</button>
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
