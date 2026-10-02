import { useEffect, useMemo, useState } from 'react';
import {
  db, ensureDefaultPrintServices,
  type PrintJob, type PrintService, type PrintChargeUnit,
} from '../data/db';

const money = (n: number) => `${n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
const makeReceiptNo = () => `S-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

const unitLabel = (u: PrintChargeUnit) => (u === 'page' ? 'حسب الصفحة' : u === 'copy' ? 'حسب النسخة' : 'سعر ثابت');

export function Printing() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [services, setServices] = useState<PrintService[]>([]);
  const [tab, setTab] = useState<'new' | 'history' | 'services'>('new');
  const [showPrintDetails, setShowPrintDetails] = useState(false);

  const [receiptNo, setReceiptNo] = useState(makeReceiptNo());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [description, setDescription] = useState('');
  const [paperSize, setPaperSize] = useState('A4');
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [pages, setPages] = useState('1');
  const [copies, setCopies] = useState('1');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [unitPrice, setUnitPrice] = useState('');
  const [extraFees, setExtraFees] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState<PrintChargeUnit>('job');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadAll() {
    const [svc, allJobs] = await Promise.all([
      ensureDefaultPrintServices(),
      db.printJobs.orderBy('createdAt').reverse().toArray(),
    ]);
    setServices(svc.sort((a, b) => a.sortOrder - b.sortOrder));
    setJobs(allJobs);
    if (!serviceId && svc.length) {
      const first = svc.find((s) => s.active) || svc[0];
      setServiceId(first.id);
      setUnitPrice(String(first.unitPrice));
    }
  }

  useEffect(() => { void loadAll(); }, []);

  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const selected = services.find((s) => s.id === serviceId) || activeServices[0];

  useEffect(() => {
    if (selected) {
      setUnitPrice(String(selected.unitPrice));
      // افتح تفاصيل الطباعة تلقائيًا لو طريقة الحساب بالصفحة
      if (selected.chargeUnit === 'page') setShowPrintDetails(true);
    }
  }, [selected?.id]);

  const pagesN = Math.max(1, Number(pages) || 1);
  const copiesN = Math.max(1, Number(copies) || 1);
  const priceN = Math.max(0, Number(unitPrice) || 0);
  const chargeUnit = selected?.chargeUnit || 'job';
  const lineTotal =
    chargeUnit === 'job' ? priceN
      : chargeUnit === 'copy' ? priceN * copiesN
        : priceN * pagesN * copiesN;
  const extras = Math.max(0, Number(extraFees) || 0);
  const discountN = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, lineTotal + extras - discountN);
  const paidN = paid.trim() === '' ? total : Math.max(0, Number(paid) || 0);

  const filtered = jobs.filter((j) =>
    `${j.receiptNo} ${j.customerName || ''} ${j.description} ${j.serviceName || j.service || ''}`
      .toLowerCase().includes(search.toLowerCase().trim()),
  );

  const stats = useMemo(() => {
    const income = jobs.reduce((s, j) => s + j.total, 0);
    const collected = jobs.reduce((s, j) => s + j.paid, 0);
    return { count: jobs.length, income, due: Math.max(0, income - collected) };
  }, [jobs]);

  function printJob(job: PrintJob) {
    const w = window.open('', '_blank', 'width=800,height=700');
    if (!w) { setNotice('اسمح بالنوافذ المنبثقة لإتمام الطباعة.'); return; }
    const serviceTitle = job.serviceName || String(job.service || 'خدمة');
    const hasPrintMeta =
      (job.pages > 1 || job.copies > 1) ||
      (job.paperSize && job.paperSize !== '—') ||
      Boolean(job.colorMode);

    const printRows = hasPrintMeta
      ? `<tr><td>المقاس / اللون</td><td>${escapeHtml(job.paperSize || '—')} / ${job.colorMode === 'color' ? 'ألوان' : job.colorMode === 'bw' ? 'أبيض وأسود' : escapeHtml(String(job.colorMode || '—'))}</td></tr>
<tr><td>الصفحات × النسخ</td><td>${job.pages} × ${job.copies}</td></tr>`
      : '';

    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال ${escapeHtml(job.receiptNo)}</title>
<style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111}h1{text-align:center;font-size:22px}p{margin:7px 0}.line{border-top:1px dashed #888;margin:14px 0}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ddd}.total{font-size:19px;font-weight:bold}</style>
</head><body>
<h1>إيصال خدمة</h1>
<p style="text-align:center">${escapeHtml(job.receiptNo)}</p>
<div class="line"></div>
<p>التاريخ: ${escapeHtml(job.date)}</p>
<p>العميل: ${escapeHtml(job.customerName || 'عميل نقدي')}</p>
<table>
<tr><td>الخدمة</td><td>${escapeHtml(serviceTitle)}</td></tr>
<tr><td>الوصف</td><td>${escapeHtml(job.description || '—')}</td></tr>
${printRows}
<tr><td>سعر الوحدة</td><td>${job.unitPrice.toFixed(2)} ج.م</td></tr>
<tr><td>رسوم إضافية</td><td>${job.extraFees.toFixed(2)} ج.م</td></tr>
<tr><td>الخصم</td><td>${job.discount.toFixed(2)} ج.م</td></tr>
<tr><td class="total">الإجمالي</td><td class="total">${job.total.toFixed(2)} ج.م</td></tr>
<tr><td>المدفوع</td><td>${job.paid.toFixed(2)} ج.م</td></tr>
<tr><td>المتبقي</td><td>${(job.total - job.paid).toFixed(2)} ج.م</td></tr>
</table>
${job.notes ? `<p>ملاحظات: ${escapeHtml(job.notes)}</p>` : ''}
<div class="line"></div>
<p style="text-align:center">شكرًا لثقتكم بنا</p>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
    w.document.close();
  }

  async function saveJob() {
    if (!receiptNo.trim()) { setNotice('اكتب رقم الإيصال.'); return; }
    if (!selected) { setNotice('أضف خدمة واحدة على الأقل من تبويب الخدمات.'); return; }
    const usePrintMeta = showPrintDetails || chargeUnit === 'page' || chargeUnit === 'copy';
    const job: PrintJob = {
      id: crypto.randomUUID(),
      receiptNo: receiptNo.trim(),
      date,
      customerName: customerName.trim() || undefined,
      serviceId: selected.id,
      serviceName: selected.name,
      service: selected.name,
      description: description.trim() || selected.name,
      paperSize: usePrintMeta ? paperSize : '—',
      colorMode: usePrintMeta ? colorMode : '—',
      pages: chargeUnit === 'page' || usePrintMeta ? pagesN : 1,
      copies: chargeUnit !== 'job' || usePrintMeta ? copiesN : 1,
      sides: usePrintMeta ? sides : '—',
      unitPrice: priceN,
      extraFees: extras,
      discount: discountN,
      total,
      paid: Math.min(total, paidN),
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await db.printJobs.add(job);
    setNotice(`تم حفظ الإيصال ${job.receiptNo}`);
    setReceiptNo(makeReceiptNo());
    setCustomerName(''); setDescription(''); setPages('1'); setCopies('1');
    setExtraFees('0'); setDiscount('0'); setPaid(''); setNotes('');
    await loadAll();
    printJob(job);
  }

  async function saveService() {
    const name = editName.trim();
    const price = Number(editPrice);
    if (!name || !Number.isFinite(price) || price < 0) {
      setNotice('أدخل اسم الخدمة وسعرًا صحيحًا.');
      return;
    }
    const now = new Date().toISOString();
    if (editingId) {
      await db.printServices.update(editingId, {
        name, unitPrice: price, chargeUnit: editUnit, updatedAt: now,
      });
      setNotice('تم تحديث الخدمة.');
    } else {
      const maxOrder = services.reduce((m, s) => Math.max(m, s.sortOrder), 0);
      await db.printServices.add({
        id: crypto.randomUUID(),
        name,
        unitPrice: price,
        chargeUnit: editUnit,
        active: true,
        sortOrder: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      });
      setNotice('تم إضافة الخدمة.');
    }
    setEditName(''); setEditPrice(''); setEditUnit('job'); setEditingId(null);
    await loadAll();
  }

  function startEdit(s: PrintService) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPrice(String(s.unitPrice));
    setEditUnit(s.chargeUnit);
    setTab('services');
  }

  async function toggleActive(s: PrintService) {
    await db.printServices.update(s.id, { active: !s.active, updatedAt: new Date().toISOString() });
    await loadAll();
  }

  async function removeService(s: PrintService) {
    if (!confirm(`حذف الخدمة «${s.name}»؟`)) return;
    await db.printServices.delete(s.id);
    if (serviceId === s.id) setServiceId('');
    await loadAll();
    setNotice('تم حذف الخدمة.');
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">مركز الخدمات</span>
          <h1>الخدمات والإيصالات</h1>
          <p>
            سجّل أي خدمة في المركز: طباعة، تصوير، تجليد، خدمات علمية، أو غيرها.
            الأدوات المكتبية تُباع من شاشة <strong>المبيعات</strong>.
          </p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void loadAll()}>تحديث السجل</button>
      </div>
      {notice && <div className="purchase-notice" role="status">{notice}</div>}

      <section className="stats-grid">
        <article className="stat-card"><span>عدد الإيصالات</span><strong>{stats.count}</strong><small>محفوظة على هذا الجهاز</small></article>
        <article className="stat-card"><span>إجمالي الخدمات</span><strong>{money(stats.income)}</strong></article>
        <article className="stat-card"><span>المتبقي للتحصيل</span><strong>{money(stats.due)}</strong></article>
      </section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" className={tab === 'new' ? 'primary-btn small' : 'secondary-btn small'} onClick={() => setTab('new')}>إيصال جديد</button>
        <button type="button" className={tab === 'history' ? 'primary-btn small' : 'secondary-btn small'} onClick={() => setTab('history')}>سجل الإيصالات</button>
        <button type="button" className={tab === 'services' ? 'primary-btn small' : 'secondary-btn small'} onClick={() => setTab('services')}>الخدمات والأسعار</button>
      </div>

      {tab === 'services' && (
        <section className="purchase-panel">
          <div className="panel-heading">
            <div>
              <h2>إدارة الخدمات</h2>
              <p>أضف أي خدمة (طباعة، تصوير، تجليد، علمية…) مع السعر وطريقة الحساب.</p>
            </div>
          </div>
          <div className="purchase-form-grid">
            <label>اسم الخدمة<input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="مثال: تجليد / خدمة بحث / تصوير A4" /></label>
            <label>السعر (ج.م)<input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></label>
            <label>طريقة الحساب
              <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as PrintChargeUnit)}>
                <option value="job">سعر ثابت للخدمة (مناسب لمعظم الخدمات)</option>
                <option value="page">حسب الصفحة (صفحات × نسخ × السعر)</option>
                <option value="copy">حسب النسخة (نسخ × السعر)</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary-btn" type="button" onClick={() => void saveService()}>
              {editingId ? 'حفظ التعديل' : 'إضافة خدمة'}
            </button>
            {editingId && (
              <button className="secondary-btn" type="button" onClick={() => { setEditingId(null); setEditName(''); setEditPrice(''); setEditUnit('job'); }}>
                إلغاء التعديل
              </button>
            )}
          </div>

          <div className="table-wrap" style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>السعر</th>
                  <th>الحساب</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{money(s.unitPrice)}</td>
                    <td>{unitLabel(s.chargeUnit)}</td>
                    <td>{s.active ? 'نشطة' : 'معطّلة'}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="secondary-btn small" type="button" onClick={() => startEdit(s)}>تعديل</button>
                      <button className="secondary-btn small" type="button" onClick={() => void toggleActive(s)}>{s.active ? 'تعطيل' : 'تفعيل'}</button>
                      <button className="secondary-btn small" type="button" onClick={() => void removeService(s)}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.length === 0 && <div className="empty-state">لا توجد خدمات. أضف أول خدمة من النموذج أعلاه.</div>}
          </div>
        </section>
      )}

      {tab === 'new' && (
        <section className="purchase-panel">
          <div className="panel-heading">
            <div>
              <h2>إيصال جديد</h2>
              <p>اختر الخدمة من قائمتك. حقول الطباعة اختيارية وتظهر عند الحاجة.</p>
            </div>
          </div>
          {activeServices.length === 0 ? (
            <div className="empty-state">
              لا توجد خدمات نشطة.
              <button className="primary-btn" type="button" style={{ marginTop: 12 }} onClick={() => setTab('services')}>إضافة خدمات</button>
            </div>
          ) : (
            <>
              <div className="purchase-form-grid">
                <label>رقم الإيصال<input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} /></label>
                <label>التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label>اسم العميل<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اختياري" /></label>
                <label>الخدمة
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    {activeServices.map((s) => <option key={s.id} value={s.id}>{s.name} — {money(s.unitPrice)}</option>)}
                  </select>
                </label>
                <label>الوصف / التفاصيل<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="اختياري — مثال: مشروع تخرج، 50 ورقة" /></label>
                <label>السعر (ج.م)<input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></label>
                {chargeUnit === 'page' && (
                  <label>عدد الصفحات<input type="number" min="1" value={pages} onChange={(e) => setPages(e.target.value)} /></label>
                )}
                {chargeUnit !== 'job' && (
                  <label>عدد النسخ<input type="number" min="1" value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
                )}
                <label>رسوم إضافية<input type="number" min="0" step="0.01" value={extraFees} onChange={(e) => setExtraFees(e.target.value)} /></label>
                <label>خصم<input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
                <label>المدفوع<input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total)} /></label>
                <label>ملاحظات<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" /></label>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="secondary-btn small"
                  onClick={() => setShowPrintDetails((v) => !v)}
                >
                  {showPrintDetails ? 'إخفاء تفاصيل الطباعة/التصوير' : 'إظهار تفاصيل الطباعة/التصوير (اختياري)'}
                </button>
              </div>

              {showPrintDetails && (
                <div className="purchase-form-grid" style={{ marginTop: 12, padding: 12, border: '1px dashed #ccc', borderRadius: 8 }}>
                  <label>المقاس
                    <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="Other">أخرى</option>
                    </select>
                  </label>
                  <label>اللون
                    <select value={colorMode} onChange={(e) => setColorMode(e.target.value as 'bw' | 'color')}>
                      <option value="bw">أبيض وأسود</option>
                      <option value="color">ألوان</option>
                    </select>
                  </label>
                  {chargeUnit === 'job' && (
                    <>
                      <label>عدد الصفحات<input type="number" min="1" value={pages} onChange={(e) => setPages(e.target.value)} /></label>
                      <label>عدد النسخ<input type="number" min="1" value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
                    </>
                  )}
                  <label>وجه الطباعة
                    <select value={sides} onChange={(e) => setSides(e.target.value as 'single' | 'double')}>
                      <option value="single">وجه واحد</option>
                      <option value="double">وجهين</option>
                    </select>
                  </label>
                </div>
              )}

              <div className="totals-box" style={{ marginTop: 12 }}>
                <div><span>طريقة الحساب</span><b>{unitLabel(chargeUnit)}</b></div>
                <div><span>الإجمالي</span><b>{money(total)}</b></div>
                <div><span>المدفوع</span><b>{money(Math.min(total, paidN))}</b></div>
                <div><span>المتبقي</span><b>{money(Math.max(0, total - paidN))}</b></div>
              </div>
              <button className="primary-btn" type="button" style={{ marginTop: 12 }} onClick={() => void saveJob()}>حفظ وطباعة الإيصال</button>
            </>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section className="purchase-panel">
          <div className="panel-heading"><div><h2>سجل الإيصالات</h2></div><span className="count-badge">{filtered.length}</span></div>
          <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الإيصال أو العميل أو الخدمة" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>التاريخ</th>
                  <th>العميل</th>
                  <th>الخدمة</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>طباعة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td>{j.receiptNo}</td>
                    <td>{j.date}</td>
                    <td>{j.customerName || '—'}</td>
                    <td>{j.serviceName || j.service || '—'}</td>
                    <td>{money(j.total)}</td>
                    <td>{money(j.paid)}</td>
                    <td><button className="secondary-btn small" type="button" onClick={() => printJob(j)}>طباعة</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty-state">لا توجد إيصالات.</div>}
          </div>
        </section>
      )}
    </div>
  );
}
