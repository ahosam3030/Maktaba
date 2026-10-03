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
  const [catalog, setCatalog] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const PURCHASE_UNITS = [
    { label: 'قطعة', api: 'PIECE' as const, defaultPcs: 1 },
    { label: 'علبة', api: 'PACK' as const, defaultPcs: 1 },
    { label: 'دستة', api: 'PACK' as const, defaultPcs: 12 },
    { label: 'كرتونة', api: 'PACK' as const, defaultPcs: 1 },
    { label: 'رزمة', api: 'PACK' as const, defaultPcs: 1 },
  ];
  type DraftLine = {
    key: string;
    barcode: string;
    productName: string;
    unitLabel: string;
    quantity: string;
    piecesPerPack: string;
    unitCost: string;
    salePrice: string;
    productId?: string;
    stock?: number | null;
  };
  type InventoryProduct = {
    id: string;
    name: string;
    barcode: string | null;
    unit: string;
    piecesPerPack: number;
    currentCost: number;
    salePrice: number;
    stock: number;
  };
  const newDraftKey = () => `P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const emptyDraftLine = (): DraftLine => ({
    key: newDraftKey(),
    barcode: '',
    productName: '',
    unitLabel: 'قطعة',
    quantity: '1',
    piecesPerPack: '1',
    unitCost: '',
    salePrice: '',
    productId: undefined,
    stock: null,
  });

  const [supplierName, setSupplierName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyDraftLine(), emptyDraftLine(), emptyDraftLine()]);
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [productReportQuery, setProductReportQuery] = useState('');
  const [productReportUnit, setProductReportUnit] = useState<'ALL' | 'PIECE' | 'PACK'>('ALL');

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
      const [s, inv, pay, ret, stock] = await Promise.all([
        apiRequest<Supplier[]>('/suppliers'),
        apiRequest<Invoice[]>('/purchases/invoices'),
        apiRequest<Payment[]>('/suppliers/payments'),
        apiRequest<PurchaseReturn[]>('/purchases/returns'),
        apiRequest<InventoryProduct[]>('/inventory'),
      ]);
      setSuppliers(s); setInvoices(inv); setPayments(pay); setReturns(ret); setCatalog(stock);
      if (!paymentSupplierId && s[0]) setPaymentSupplierId(s[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات المشتريات.');
    } finally {
      setLoading(false);
    }
  }, [paymentSupplierId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filledLines = useMemo(() => lines.filter((l) => l.productName.trim() && Number(l.quantity) > 0 && Number(l.unitCost) >= 0 && l.unitCost !== ''), [lines]);
  const subtotal = useMemo(
    () => filledLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [filledLines],
  );
  const discountN = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountN);

  function updateDraft(key: string, patch: Partial<DraftLine>) {
    setLines((old) => old.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addDraftRow() {
    setLines((old) => [...old, emptyDraftLine()]);
  }

  function removeDraftRow(key: string) {
    setLines((old) => (old.length <= 1 ? [emptyDraftLine()] : old.filter((l) => l.key !== key)));
  }

  function clearDraft() {
    setLines([emptyDraftLine(), emptyDraftLine(), emptyDraftLine()]);
    setInvoiceNo('');
    setPaid('0');
    setDiscount('0');
    setNotes('');
    setNotice('');
  }

  function nextPurchaseInvoiceNo(): string {
    let max = 0;
    for (const inv of invoices) {
      const m = String(inv.invoiceNumber || '').match(/(\d+)\s*$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    return String(max + 1);
  }

  function unitApi(label: string): 'PIECE' | 'PACK' {
    return PURCHASE_UNITS.find((u) => u.label === label)?.api || 'PIECE';
  }

  function piecePrice(l: DraftLine): number | null {
    const cost = Number(l.unitCost);
    if (!Number.isFinite(cost) || l.unitCost === '') return null;
    if (unitApi(l.unitLabel) === 'PACK') {
      const ppp = Math.max(1, Math.floor(Number(l.piecesPerPack) || 1));
      return cost / ppp;
    }
    return cost;
  }

  /** آخر سعر لنفس الصنف/الوحدة من فواتير سابقة (مثل النسخة القديمة) */
  function lastPurchaseHint(name: string, unitLabel: string): string {
    const n = name.trim().toLowerCase();
    if (!n) return '';
    const unit = unitApi(unitLabel);
    const matches = allPricePoints.filter(
      (p) => p.productName.toLowerCase() === n && (unit === 'PACK' ? p.unit === 'علبة' : p.unit === 'قطعة'),
    );
    // fallback: any unit same name
    const list = matches.length ? matches : allPricePoints.filter((p) => p.productName.toLowerCase() === n);
    if (!list.length) return '';
    const last = list[list.length - 1];
    return `«${last.productName}»: آخر سعر ${last.unitCost} ج من ${last.supplier} بتاريخ ${last.date}`;
  }

  function findCatalogProduct(barcode?: string, name?: string): InventoryProduct | undefined {
    const bc = (barcode || '').trim().toLowerCase();
    const nm = (name || '').trim().toLowerCase();
    if (bc) {
      const byBarcode = catalog.find((p) => (p.barcode || '').trim().toLowerCase() === bc);
      if (byBarcode) return byBarcode;
    }
    if (nm) {
      return catalog.find((p) => p.name.trim().toLowerCase() === nm);
    }
    return undefined;
  }

  function applyProductToLine(key: string, product: InventoryProduct) {
    const unitLabel = product.unit === 'PACK' ? 'علبة' : 'قطعة';
    updateDraft(key, {
      productId: product.id,
      productName: product.name,
      barcode: product.barcode || '',
      unitLabel,
      piecesPerPack: String(product.piecesPerPack || 1),
      // تكلفة الشراء الحالية كاقتراح لسعر الوحدة عند الشراء بالقطعة
      unitCost: product.currentCost > 0 ? String(product.currentCost) : '',
      salePrice: product.salePrice > 0 ? String(product.salePrice) : '',
      stock: product.stock,
    });
    setNotice(`تم جلب «${product.name}» — المتبقي: ${product.stock} قطعة | تكلفة: ${product.currentCost} | بيع: ${product.salePrice}`);
  }

  function fillFromBarcode(key: string, barcode: string) {
    const bc = barcode.trim();
    if (!bc) return;
    const product = findCatalogProduct(bc);
    if (product) {
      applyProductToLine(key, product);
      return;
    }
    setNotice(`لا يوجد صنف مسجّل بالباركود «${bc}». يمكنك إدخاله كصنف جديد.`);
  }

  function fillFromProductName(key: string, name: string) {
    const product = findCatalogProduct(undefined, name);
    if (product) applyProductToLine(key, product);
  }

  function lineProfitPerPiece(l: DraftLine): number | null {
    const cost = piecePrice(l);
    const sale = Number(l.salePrice);
    if (cost === null || !Number.isFinite(sale) || l.salePrice === '') return null;
    return sale - cost;
  }

  function printDraftInvoice() {
    const items = filledLines;
    if (!supplierName.trim() && items.length === 0) {
      setNotice('أدخل بيانات للطباعة.');
      return;
    }
    const draft: Invoice = {
      id: 'draft',
      invoiceNumber: invoiceNo.trim() || 'مسودة',
      invoiceDate: date,
      supplierId: '',
      supplier: { id: '', name: supplierName.trim() || '—' },
      items: items.map((l, i) => ({
        id: String(i),
        productId: '',
        productName: l.productName.trim(),
        unit: unitApi(l.unitLabel),
        quantity: Number(l.quantity) || 0,
        unitCost: Number(l.unitCost) || 0,
        piecesPerPack: unitApi(l.unitLabel) === 'PACK' ? Math.max(1, Math.floor(Number(l.piecesPerPack) || 1)) : 1,
        lineTotal: (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
        returnedQuantity: 0,
      })),
      subtotal,
      discount: discountN,
      total,
      paidAmount: Math.min(total, Math.max(0, Number(paid) || 0)),
    };
    printInvoice(draft);
  }

  async function saveInvoice(andPrint = false) {
    if (!supplierName.trim()) {
      setNotice('أدخل اسم الشركة / المورد.');
      return;
    }
    if (filledLines.length === 0) {
      setNotice('أضف صنفًا واحدًا على الأقل (اسم + كمية + سعر).');
      return;
    }
    const invNo = invoiceNo.trim() || nextPurchaseInvoiceNo();
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
          invoiceNumber: invNo,
          invoiceDate: date,
          discount: discountN,
          paidAmount: paidN,
          notes: notes.trim() || undefined,
          items: filledLines.map((l) => ({
            productName: l.productName.trim(),
            barcode: l.barcode.trim() || undefined,
            unit: unitApi(l.unitLabel),
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
            piecesPerPack: unitApi(l.unitLabel) === 'PACK' ? Math.max(1, Math.floor(Number(l.piecesPerPack) || 1)) : 1,
            salePrice: l.salePrice !== '' && Number.isFinite(Number(l.salePrice)) ? Number(l.salePrice) : undefined,
          })),
        }),
      });
      setNotice(`تم حفظ فاتورة الوارد ${created.invoiceNumber}.`);
      clearDraft();
      setSupplierName(supplierName);
      await refresh();
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

  async function deletePurchaseInvoice(invoice: Invoice) {
    if (!confirm(`حذف فاتورة الوارد رقم ${invoice.invoiceNumber}؟\nسيتم خصم الكميات من المخزون.`)) return;
    try {
      await apiRequest(`/purchases/invoices/${invoice.id}`, { method: 'DELETE' });
      setNotice(`تم حذف فاتورة الوارد ${invoice.invoiceNumber}.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حذف الفاتورة.');
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

  type PricePoint = {
    date: string;
    supplier: string;
    productName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    invoiceNumber: string;
    invoiceId: string;
  };

  const allPricePoints = useMemo(() => {
    const points: PricePoint[] = [];
    for (const inv of invoices) {
      for (const it of inv.items || []) {
        points.push({
          date: String(inv.invoiceDate).slice(0, 10),
          supplier: inv.supplier?.name || '—',
          productName: it.productName,
          unit: it.unit === 'PACK' ? 'علبة' : 'قطعة',
          quantity: num(it.quantity),
          unitCost: num(it.unitCost),
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv.id,
        });
      }
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  }, [invoices]);

  const productNames = useMemo(() => {
    const set = new Set(allPricePoints.map((p) => p.productName));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allPricePoints]);

  const productReport = useMemo(() => {
    const q = productReportQuery.trim().toLowerCase();
    if (!q) return null;
    let rows = allPricePoints.filter((p) => p.productName.toLowerCase().includes(q));
    if (productReportUnit === 'PIECE') rows = rows.filter((p) => p.unit === 'قطعة');
    if (productReportUnit === 'PACK') rows = rows.filter((p) => p.unit === 'علبة');
    if (rows.length === 0) return { name: productReportQuery.trim(), rows: [] as PricePoint[], bySupplier: [] as Array<{ supplier: string; last: number; min: number; max: number; avg: number; count: number; lastDate: string }>, stats: null };

    const prices = rows.map((r) => r.unitCost);
    const last = rows[rows.length - 1];
    const stats = {
      last: last.unitCost,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((s, x) => s + x, 0) / prices.length,
      count: rows.length,
      name: last.productName,
      unitLabel: productReportUnit === 'PACK' ? 'علبة' : productReportUnit === 'PIECE' ? 'قطعة' : 'كل الوحدات',
    };

    const supplierMap = new Map<string, PricePoint[]>();
    for (const r of rows) {
      if (!supplierMap.has(r.supplier)) supplierMap.set(r.supplier, []);
      supplierMap.get(r.supplier)!.push(r);
    }
    const bySupplier = Array.from(supplierMap.entries()).map(([supplier, list]) => {
      const ps = list.map((x) => x.unitCost);
      const lastRow = list[list.length - 1];
      return {
        supplier,
        last: lastRow.unitCost,
        lastDate: lastRow.date,
        min: Math.min(...ps),
        max: Math.max(...ps),
        avg: ps.reduce((s, x) => s + x, 0) / ps.length,
        count: list.length,
      };
    }).sort((a, b) => a.min - b.min);

    // with change vs previous purchase of same product
    const history = rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].unitCost : null;
      const change = prev === null ? null : r.unitCost - prev;
      return { ...r, change, isFirst: i === 0 };
    }).reverse();

    return { name: stats.name, rows: history, bySupplier, stats };
  }, [allPricePoints, productReportQuery, productReportUnit]);

  function printProductReport() {
    if (!productReport?.stats) { setNotice('اختر منتجًا له مشتريات أولًا.'); return; }
    const w = window.open('', '_blank');
    if (!w) { setNotice('اسمح بالنوافذ المنبثقة.'); return; }
    const s = productReport.stats;
    const supplierRows = productReport.bySupplier.map((r) =>
      `<tr><td>${escapeHtml(r.supplier)}</td><td>${r.last.toFixed(2)}</td><td>${r.lastDate}</td><td>${r.min.toFixed(2)}</td><td>${r.max.toFixed(2)}</td><td>${r.avg.toFixed(2)}</td><td>${r.count}</td></tr>`
    ).join('');
    const histRows = productReport.rows.map((r) => {
      const ch = r.change === null ? 'أول شراء' : (r.change > 0 ? `+${r.change.toFixed(2)} ▲` : r.change < 0 ? `${r.change.toFixed(2)} ▼` : 'بدون تغيير');
      return `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.supplier)}</td><td>${r.quantity} ${escapeHtml(r.unit)}</td><td>${r.unitCost.toFixed(2)}</td><td>${ch}</td><td>${escapeHtml(r.invoiceNumber)}</td></tr>`;
    }).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${escapeHtml(s.name)}</title>
<style>body{font-family:Tahoma,Arial;padding:16px}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:center}th{background:#eef5f3}
h1{color:#0f766e}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
.stats div{border:1px solid #ddd;border-radius:8px;padding:8px 14px;background:#f7faf9}</style></head><body>
<h1>تقرير المنتج: ${escapeHtml(s.name)} (${escapeHtml(s.unitLabel)})</h1>
<div class="stats">
<div><b>آخر سعر</b><br>${s.last.toFixed(2)}</div>
<div><b>أقل</b><br>${s.min.toFixed(2)}</div>
<div><b>أعلى</b><br>${s.max.toFixed(2)}</div>
<div><b>المتوسط</b><br>${s.avg.toFixed(2)}</div>
<div><b>مرات الشراء</b><br>${s.count}</div>
</div>
<h2>المقارنة بين الشركات (الأرخص أولًا)</h2>
<table><thead><tr><th>الشركة</th><th>آخر سعر</th><th>تاريخه</th><th>أقل</th><th>أعلى</th><th>المتوسط</th><th>مرات</th></tr></thead>
<tbody>${supplierRows}</tbody></table>
<h2>تاريخ الأسعار</h2>
<table><thead><tr><th>التاريخ</th><th>الشركة</th><th>الكمية</th><th>السعر</th><th>التغير</th><th>رقم الفاتورة</th></tr></thead>
<tbody>${histRows}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

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
        <div className="panel-heading">
          <div>
            <h2>فاتورة وارد</h2>
            <p>امسح الباركود لجلب الصنف والمتبقي وسعر البيع. المكسب = سعر البيع − تكلفة القطعة.</p>
          </div>
        </div>

        <div className="sale-meta-row" style={{ gridTemplateColumns: '1.3fr 0.9fr 0.9fr 0.9fr 0.8fr' }}>
          <label>اسم الشركة / المورد
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} list="supplier-list" placeholder="اكتب أو اختر" />
          </label>
          <datalist id="supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          <datalist id="product-name-list">{catalog.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          <label>التاريخ
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>رقم الفاتورة (اختياري)
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="تلقائي إن تُرك فارغًا" />
          </label>
          <label>نوع الفاتورة
            <input value="فاتورة وارد" readOnly />
          </label>
          <label>المدفوع للمورد الآن
            <input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </label>
        </div>

        <div className="sale-lines-wrap" style={{ marginTop: 12 }}>
          <table className="sale-lines-table">
            <thead>
              <tr>
                <th>باركود</th>
                <th>الصنف</th>
                <th>الوحدة</th>
                <th>الكمية</th>
                <th>قطع في الوحدة</th>
                <th>سعر الشراء</th>
                <th>تكلفة القطعة</th>
                <th>سعر البيع</th>
                <th>المكسب/قطعة</th>
                <th>المتبقي</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const q = Number(l.quantity) || 0;
                const c = Number(l.unitCost) || 0;
                const lineTotal = q * c;
                const pp = piecePrice(l);
                const profit = lineProfitPerPiece(l);
                return (
                  <tr key={l.key}>
                    <td>
                      <input
                        placeholder="باركود"
                        value={l.barcode}
                        onChange={(e) => updateDraft(l.key, { barcode: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            fillFromBarcode(l.key, (e.target as HTMLInputElement).value);
                          }
                        }}
                        onBlur={(e) => fillFromBarcode(l.key, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        placeholder="اسم الصنف"
                        value={l.productName}
                        list="product-name-list"
                        onChange={(e) => updateDraft(l.key, { productName: e.target.value })}
                        onBlur={(e) => fillFromProductName(l.key, e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={l.unitLabel}
                        onChange={(e) => {
                          const label = e.target.value;
                          const meta = PURCHASE_UNITS.find((u) => u.label === label);
                          updateDraft(l.key, {
                            unitLabel: label,
                            piecesPerPack: String(meta?.defaultPcs ?? 1),
                          });
                        }}
                      >
                        {PURCHASE_UNITS.map((u) => (
                          <option key={u.label} value={u.label}>{u.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.quantity}
                        onChange={(e) => updateDraft(l.key, { quantity: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.piecesPerPack}
                        disabled={unitApi(l.unitLabel) !== 'PACK'}
                        onChange={(e) => updateDraft(l.key, { piecesPerPack: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.unitCost}
                        placeholder="0"
                        onChange={(e) => updateDraft(l.key, { unitCost: e.target.value })}
                      />
                    </td>
                    <td>{pp === null ? '—' : pp.toLocaleString('ar-EG', { maximumFractionDigits: 3 })}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.salePrice}
                        placeholder="0"
                        title="سعر بيع القطعة"
                        onChange={(e) => updateDraft(l.key, { salePrice: e.target.value })}
                      />
                    </td>
                    <td style={{ color: profit === null ? undefined : profit >= 0 ? '#0a7a4b' : '#b42318', fontWeight: 600 }}>
                      {profit === null ? '—' : profit.toLocaleString('ar-EG', { maximumFractionDigits: 3 })}
                    </td>
                    <td title="الكمية المتبقية في المخزون قبل هذه الفاتورة">
                      {l.stock === null || l.stock === undefined ? '—' : l.stock.toLocaleString('ar-EG')}
                    </td>
                    <td>{lineTotal ? lineTotal.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : '0'}</td>
                    <td>
                      <button className="danger-outline-btn" type="button" onClick={() => removeDraftRow(l.key)}>حذف</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="add-line-btn" type="button" onClick={addDraftRow}>+ إضافة صنف</button>
        </div>

        {lines.some((l) => l.productName.trim()) && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#5a7076' }}>
            {lines.filter((l) => l.productName.trim()).map((l) => {
              const h = lastPurchaseHint(l.productName, l.unitLabel);
              return h ? <div key={l.key}>{h}</div> : null;
            })}
          </div>
        )}

        <div className="sale-pay-row">
          <div className="sale-pay-fields">
            <label>خصم (ج)
              <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
            <label>ملاحظات
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <div className="sale-summary">
            <div>إجمالي الفاتورة: <strong>{money(total)}</strong></div>
          </div>
        </div>

        <div className="sale-actions">
          <button className="primary-btn" type="button" onClick={() => void saveInvoice(false)}>حفظ الفاتورة</button>
          <button className="primary-btn" type="button" onClick={() => void saveInvoice(true)}>حفظ وطباعة</button>
          <button className="secondary-btn" type="button" onClick={printDraftInvoice}>طباعة (حتى قبل الحفظ)</button>
          <button className="secondary-btn" type="button" onClick={clearDraft}>فاتورة فارغة</button>
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

      <section className="purchase-panel product-report-panel">
        <div className="product-report-search">
          <input
            value={productReportQuery}
            onChange={(e) => setProductReportQuery(e.target.value)}
            list="product-report-list"
            placeholder="ابحث عن منتج (اسم أو جزء من الاسم أو باركود)"
          />
          <datalist id="product-report-list">
            {productNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>

        {productReportQuery.trim() && !productReport?.stats && (
          <div className="empty-state">لا مشتريات مسجّلة لهذا الاسم. سجّل فواتير وارد أولًا.</div>
        )}

        {productReport?.stats && (() => {
          const s = productReport.stats;
          // نقاط الرسم من الأقدم للأحدث
          const chartPts = [...productReport.rows].reverse();
          const prices = chartPts.map((p) => p.unitCost);
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          const range = Math.max(1, maxP - minP);
          const w = 560;
          const h = 160;
          const pad = 20;
          const coords = chartPts.map((p, i) => {
            const x = pad + (chartPts.length === 1 ? (w - pad * 2) / 2 : (i / (chartPts.length - 1)) * (w - pad * 2));
            const y = pad + (1 - (p.unitCost - minP) / range) * (h - pad * 2);
            return { x, y, p };
          });
          const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

          return (
            <div className="product-report-card">
              <div className="product-report-head">
                <h2>
                  تقرير المنتج: {s.name}
                  <span className="unit-tag">({s.unitLabel === 'علبة' ? 'بالعلبة' : s.unitLabel === 'قطعة' ? 'بالقطعة' : s.unitLabel})</span>
                </h2>
                <div className="product-report-kpis">
                  <div><span>آخر سعر</span><b>{s.last.toLocaleString('ar-EG')} ج</b></div>
                  <div><span>أقل سعر</span><b>{s.min.toLocaleString('ar-EG')}</b></div>
                  <div><span>أعلى سعر</span><b>{s.max.toLocaleString('ar-EG')}</b></div>
                  <div><span>المتوسط</span><b>{Math.round(s.avg).toLocaleString('ar-EG')}</b></div>
                  <div><span>مرات الشراء</span><b>{s.count}</b></div>
                </div>
                <div className="product-report-unit-row">
                  <label>
                    الوحدة (الأسعار بتتقارن لنفس الوحدة بس)
                    <select value={productReportUnit} onChange={(e) => setProductReportUnit(e.target.value as 'ALL' | 'PIECE' | 'PACK')}>
                      <option value="ALL">الكل</option>
                      <option value="PACK">علبة</option>
                      <option value="PIECE">قطعة</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="product-report-chart">
                <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="180" role="img" aria-label="منحنى الأسعار">
                  <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#dbe5e5" />
                  <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" points={polyline} />
                  {coords.map((c, i) => (
                    <g key={i}>
                      <circle cx={c.x} cy={c.y} r="5" fill="#0f766e" />
                      <text x={c.x} y={c.y - 10} textAnchor="middle" fontSize="11" fill="#5a7076">{c.p.unitCost}</text>
                    </g>
                  ))}
                </svg>
                <div className="product-report-actions">
                  <button className="secondary-btn" type="button" onClick={printProductReport}>طباعة التقرير</button>
                  <button className="secondary-btn" type="button" onClick={() => setProductReportQuery('')}>كل المنتجات</button>
                </div>
              </div>

              <div className="product-report-block">
                <h3>المقارنة بين الشركات (الأرخص أولًا)</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>الشركة</th>
                        <th>آخر سعر</th>
                        <th>تاريخه</th>
                        <th>أقل</th>
                        <th>أعلى</th>
                        <th>المتوسط</th>
                        <th>مرات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productReport.bySupplier.map((r) => (
                        <tr key={r.supplier}>
                          <td>{r.supplier}</td>
                          <td>{r.last.toLocaleString('ar-EG')}</td>
                          <td>{r.lastDate}</td>
                          <td>{r.min.toLocaleString('ar-EG')}</td>
                          <td>{r.max.toLocaleString('ar-EG')}</td>
                          <td>{Math.round(r.avg).toLocaleString('ar-EG')}</td>
                          <td>{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="product-report-block">
                <h3>تاريخ الأسعار</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>الشركة</th>
                        <th>الكمية</th>
                        <th>السعر</th>
                        <th>التغير</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productReport.rows.map((r, idx) => {
                        const ch = r.change === null
                          ? <span style={{ color: '#647b80' }}>أول شراء</span>
                          : r.change > 0
                            ? <span className="price-up">{Math.abs(r.change).toFixed(0)}+ ▲</span>
                            : r.change < 0
                              ? <span className="price-down">{Math.abs(r.change).toFixed(0)}- ▼</span>
                              : <span className="price-same">—</span>;
                        return (
                          <tr key={`${r.invoiceId}-${idx}`}>
                            <td>{r.date}</td>
                            <td>{r.supplier}</td>
                            <td>{r.unit} {r.quantity}</td>
                            <td>{r.unitCost.toLocaleString('ar-EG')}</td>
                            <td>{ch}</td>
                            <td>
                              <button
                                className="secondary-btn small"
                                type="button"
                                onClick={() => {
                                  const inv = invoices.find((i) => i.id === r.invoiceId);
                                  if (inv) printInvoice(inv);
                                }}
                              >
                                طباعة
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
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
              <td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="secondary-btn small" type="button" onClick={() => printInvoice(i)}>طباعة</button>
                  <button
                    className="danger-outline-btn"
                    type="button"
                    onClick={() => void deletePurchaseInvoice(i)}
                  >
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}</tbody></table>
          {filtered.length === 0 && <div className="empty-state">لا توجد فواتير.</div>}
        </div>
      </section>
    </div>
  );
}
