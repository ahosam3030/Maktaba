import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getToken } from '../data/api';

type Supplier = { id: string; name: string; phone?: string | null };
type InvoiceItem = {
  id: string; productId: string; productName: string; unit: string; quantity: number | string;
  unitCost: number | string; piecesPerPack: number; lineTotal: number | string; returnedQuantity: number | string;
};
type Invoice = {
  id: string; invoiceNumber: string; invoiceDate: string; supplierId: string;
  supplier?: { id: string; name: string }; items: InvoiceItem[];
  subtotal: number | string; discount: number | string; total: number | string; paidAmount: number | string; notes?: string | null;
};
type Payment = { id: string; supplierId: string; amount: number | string; paymentDate: string; method: string; supplier?: { name: string } };
type PurchaseReturn = { id: string; invoiceId: string; total: number | string; returnDate: string; items: Array<{ productId: string; quantity: number | string }> };

const money = (n: number) => `${n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
const num = (v: number | string) => Number(v) || 0;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export function Purchases() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [supplierName, setSupplierName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [productName, setProductName] = useState('');
  const [unit, setUnit] = useState<'PIECE' | 'PACK'>('PIECE');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [piecesPerPack, setPiecesPerPack] = useState('1');
  const [lines, setLines] = useState<Array<{ productName: string; unit: 'PIECE' | 'PACK'; quantity: number; unitCost: number; piecesPerPack: number }>>([]);
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const [paymentSupplierId, setPaymentSupplierId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  const [returnInvoiceId, setReturnInvoiceId] = useState('');
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState('1');

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setError('سجّل الدخول أولًا لاستخدام فواتير الوارد على الخادم.');
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try {
      const [s, inv, pay, ret] = await Promise.all([
        apiRequest<Supplier[]>('/suppliers'),
        apiRequest<Invoice[]>('/purchases/invoices'),
        apiRequest<Payment[]>('/suppliers/payments'),
        apiRequest<PurchaseReturn[]>('/purchases/returns'),
      ]);
      setSuppliers(s); setInvoices(inv); setPayments(pay); setReturns(ret);
      if (!paymentSupplierId && s[0]) setPaymentSupplierId(s[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات المشتريات.');
    } finally {
      setLoading(false);
    }
  }, [paymentSupplierId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitCost, 0), [lines]);
  const discountN = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountN);

  function addLine() {
    const q = Number(quantity); const c = Number(unitCost); const ppp = Math.max(1, Math.floor(Number(piecesPerPack) || 1));
    if (!productName.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(c) || c < 0) {
      setNotice('أكمل اسم الصنف والكمية والسعر.');
      return;
    }
    setLines((old) => [...old, { productName: productName.trim(), unit, quantity: q, unitCost: c, piecesPerPack: unit === 'PACK' ? ppp : 1 }]);
    setProductName(''); setQuantity('1'); setUnitCost(''); setPiecesPerPack('1'); setNotice('');
  }

  async function saveInvoice(andPrint = false) {
    if (!supplierName.trim() || !invoiceNo.trim() || lines.length === 0) {
      setNotice('أدخل المورد ورقم الفاتورة وصنفًا واحدًا على الأقل.');
      return;
    }
    const paidN = Math.min(total, Math.max(0, Number(paid) || 0));
    try {
      const supplier = await apiRequest<Supplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify({ name: supplierName.trim() }),
      });
      const created = await apiRequest<Invoice>('/purchases/invoices', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplier.id,
          invoiceNumber: invoiceNo.trim(),
          invoiceDate: date,
          discount: discountN,
          paidAmount: paidN,
          notes: notes.trim() || undefined,
          items: lines.map((l) => ({
            productName: l.productName,
            unit: l.unit,
            quantity: l.quantity,
            unitCost: l.unitCost,
            piecesPerPack: l.piecesPerPack,
          })),
        }),
      });
      setNotice('تم حفظ فاتورة الوارد على الخادم.');
      setLines([]); setInvoiceNo(''); setDiscount('0'); setPaid('0'); setNotes('');
      await refresh();
      // optional: print right after save
      if (andPrint && created?.id) printInvoice(created);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حفظ الفاتورة.');
    }
  }

  async function savePayment() {
    const amount = Number(paymentAmount);
    if (!paymentSupplierId || !Number.isFinite(amount) || amount <= 0) {
      setNotice('اختر المورد وأدخل مبلغ الدفعة.');
      return;
    }
    try {
      await apiRequest('/suppliers/payments', {
        method: 'POST',
        body: JSON.stringify({ supplierId: paymentSupplierId, amount, paymentDate, method: 'CASH' }),
      });
      setNotice('تم تسجيل الدفعة.');
      setPaymentAmount('');
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر تسجيل الدفعة.');
    }
  }

  async function saveReturn() {
    const q = Number(returnQty);
    if (!returnInvoiceId || !returnItemId || !Number.isFinite(q) || q <= 0) {
      setNotice('اختر الفاتورة والصنف وكمية المرتجع.');
      return;
    }
    try {
      await apiRequest('/purchases/returns', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: returnInvoiceId, items: [{ invoiceItemId: returnItemId, quantity: q }] }),
      });
      setNotice('تم تسجيل المرتجع.');
      setReturnQty('1');
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر تسجيل المرتجع.');
    }
  }

  function printInvoice(invoice: Invoice) {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = invoice.items.map((l) =>
      `<tr><td>${escapeHtml(l.productName)}</td><td>${l.unit === 'PACK' ? 'علبة' : 'قطعة'}</td><td>${num(l.quantity)}</td><td>${l.piecesPerPack}</td><td>${money(num(l.unitCost))}</td><td>${money(num(l.lineTotal))}</td></tr>`
    ).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${escapeHtml(invoice.invoiceNumber)}</title>
<style>body{font-family:Tahoma,Arial;padding:24px;color:#222}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:8px;text-align:right;font-size:13px}th{background:#eee}.totals{margin-top:20px;width:320px;margin-right:auto}.totals div{display:flex;justify-content:space-between;padding:5px}</style>
</head><body><h1>فاتورة مشتريات / وارد</h1>
<p>رقم الفاتورة: ${escapeHtml(invoice.invoiceNumber)} &nbsp; | &nbsp; التاريخ: ${escapeHtml(String(invoice.invoiceDate).slice(0, 10))}</p>
<p>المورد: ${escapeHtml(invoice.supplier?.name || '')}</p>
<table><thead><tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>قطعة/علبة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>قبل الخصم</span><b>${money(num(invoice.subtotal))}</b></div>
<div><span>الخصم</span><b>${money(num(invoice.discount))}</b></div>
<div><span>الإجمالي</span><b>${money(num(invoice.total))}</b></div>
<div><span>المدفوع</span><b>${money(num(invoice.paidAmount))}</b></div></div>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  const filtered = invoices.filter((i) =>
    `${i.invoiceNumber} ${i.supplier?.name || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedInvoice = invoices.find((i) => i.id === returnInvoiceId);

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div><span className="eyebrow">المشتريات</span><h1>المشتريات</h1><p>مرتبطة بالخادم PostgreSQL وتؤثر على المخزون فور الحفظ.</p></div>
        <button className="secondary-btn" onClick={() => void refresh()}>تحديث</button>
      </div>
      {notice && <div className="purchase-notice" role="status">{notice}</div>}
      {error && <div className="purchase-notice" role="alert">{error}</div>}
      {loading && <div className="empty-state">جارٍ التحميل...</div>}

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>فاتورة وارد جديدة</h2><p>التكلفة تُحفظ لكل قطعة تلقائيًا حتى عند الشراء بالعلبة.</p></div></div>
        <div className="purchase-form-grid">
          <label>المورد<input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} list="supplier-list" placeholder="اسم المورد" /></label>
          <datalist id="supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          <label>رقم الفاتورة<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></label>
          <label>التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <div className="purchase-form-grid">
          <label>الصنف<input value={productName} onChange={(e) => setProductName(e.target.value)} /></label>
          <label>الوحدة<select value={unit} onChange={(e) => setUnit(e.target.value as 'PIECE' | 'PACK')}><option value="PIECE">قطعة</option><option value="PACK">علبة</option></select></label>
          <label>الكمية<input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label>سعر الوحدة<input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></label>
          {unit === 'PACK' && <label>قطع/علبة<input type="number" min="1" step="1" value={piecesPerPack} onChange={(e) => setPiecesPerPack(e.target.value)} /></label>}
          <button className="secondary-btn" type="button" onClick={addLine}>إضافة صنف</button>
        </div>
        {lines.length > 0 && (
          <div className="table-wrap"><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>{lines.map((l, i) => (
              <tr key={i}><td>{l.productName}</td><td>{l.unit === 'PACK' ? 'علبة' : 'قطعة'}</td><td>{l.quantity}</td><td>{money(l.unitCost)}</td><td>{money(l.quantity * l.unitCost)}</td>
                <td><button className="icon-btn" type="button" onClick={() => setLines((old) => old.filter((_, idx) => idx !== i))}>×</button></td></tr>
            ))}</tbody></table></div>
        )}
        <div className="purchase-form-grid">
          <label>الخصم<input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
          <label>المدفوع<input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} /></label>
          <label>ملاحظات<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div><strong>الإجمالي: {money(total)}</strong></div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="primary-btn" type="button" onClick={() => void saveInvoice(false)}>حفظ الفاتورة على الخادم</button>
          <button className="secondary-btn" type="button" onClick={() => void saveInvoice(true)}>حفظ وطباعة</button>
        </div>
        </div>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>دفعات الموردين</h2></div></div>
        <div className="inline-form">
          <label>المورد<select value={paymentSupplierId} onChange={(e) => setPaymentSupplierId(e.target.value)}><option value="">اختر</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>المبلغ<input type="number" min="0" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
          <label>التاريخ<input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label>
          <button className="primary-btn" type="button" onClick={() => void savePayment()}>حفظ الدفعة</button>
        </div>
        <div className="table-wrap"><table><thead><tr><th>المورد</th><th>المبلغ</th><th>التاريخ</th><th>الطريقة</th></tr></thead>
          <tbody>{payments.slice(0, 20).map((p) => <tr key={p.id}><td>{p.supplier?.name}</td><td>{money(num(p.amount))}</td><td>{String(p.paymentDate).slice(0, 10)}</td><td>{p.method}</td></tr>)}</tbody></table></div>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>مرتجع مشتريات</h2></div></div>
        <div className="inline-form">
          <label>الفاتورة<select value={returnInvoiceId} onChange={(e) => { setReturnInvoiceId(e.target.value); setReturnItemId(''); }}>
            <option value="">اختر</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} — {i.supplier?.name}</option>)}
          </select></label>
          <label>الصنف<select value={returnItemId} onChange={(e) => setReturnItemId(e.target.value)}>
            <option value="">اختر</option>
            {selectedInvoice?.items.map((it) => (
              <option key={it.id} value={it.id}>{it.productName} (متبقي {num(it.quantity) - num(it.returnedQuantity)})</option>
            ))}
          </select></label>
          <label>الكمية<input type="number" min="0.001" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} /></label>
          <button className="primary-btn" type="button" onClick={() => void saveReturn()}>حفظ المرتجع</button>
        </div>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>سجل الفواتير</h2></div><span className="count-badge">{filtered.length}</span></div>
        <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو المورد" />
        <div className="table-wrap"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th>الأصناف</th><th>الإجمالي</th><th>المدفوع</th><th>طباعة</th></tr></thead>
          <tbody>{filtered.map((i) => (
            <tr key={i.id}>
              <td>{i.invoiceNumber}</td>
              <td>{String(i.invoiceDate).slice(0, 10)}</td>
              <td>{i.supplier?.name}</td>
              <td>{i.items.length}</td>
              <td>{money(num(i.total))}</td>
              <td>{money(num(i.paidAmount))}</td>
              <td><button className="secondary-btn small" type="button" onClick={() => printInvoice(i)}>طباعة</button></td>
            </tr>
          ))}</tbody></table>
          {filtered.length === 0 && <div className="empty-state">لا توجد فواتير.</div>}
        </div>
      </section>
    </div>
  );
}
