import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../data/api';
import { IconPrint, IconRefresh, IconReceipt, IconWallet } from './Icons';

type ChargeUnit = 'page' | 'copy' | 'job';

type Service = {
  id: string;
  name: string;
  unitPrice: number;
  chargeUnit: ChargeUnit;
  active: boolean;
  sortOrder: number;
  notes?: string | null;
};

type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  customerName?: string | null;
  serviceId?: string | null;
  serviceName: string;
  service?: string;
  description?: string | null;
  paperSize?: string | null;
  colorMode?: string | null;
  pages: number;
  copies: number;
  sides?: string | null;
  unitPrice: number;
  extraFees: number;
  discount: number;
  total: number;
  paid: number;
  notes?: string | null;
  cashTransactionId?: string | null;
};

const money = (n: number) =>
  `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

const makeReceiptNo = () =>
  `S-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

const unitLabel = (u: ChargeUnit) =>
  u === 'page' ? 'حسب الصفحة' : u === 'copy' ? 'حسب النسخة' : 'سعر ثابت';

export function Printing() {
  const [jobs, setJobs] = useState<Receipt[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tab, setTab] = useState<'new' | 'history' | 'services'>('new');
  const [showPrintDetails, setShowPrintDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
  const [error, setError] = useState('');

  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState<ChargeUnit>('job');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [svc, receipts] = await Promise.all([
        apiRequest<Service[]>('/services'),
        apiRequest<Receipt[]>('/service-receipts'),
      ]);
      setServices(svc);
      setJobs(receipts);
      setServiceId((cur) => {
        if (cur && svc.some((s) => s.id === cur)) return cur;
        const first = svc.find((s) => s.active) || svc[0];
        if (first) {
          setUnitPrice(String(first.unitPrice));
          return first.id;
        }
        return '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الخدمات والإيصالات من الخادم.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const selected = services.find((s) => s.id === serviceId) || activeServices[0];

  useEffect(() => {
    if (selected) {
      setUnitPrice(String(selected.unitPrice));
      if (selected.chargeUnit === 'page') setShowPrintDetails(true);
    }
  }, [selected?.id]);

  const pagesN = Math.max(1, Number(pages) || 1);
  const copiesN = Math.max(1, Number(copies) || 1);
  const priceN = Math.max(0, Number(unitPrice) || 0);
  const chargeUnit = selected?.chargeUnit || 'job';
  const lineTotal =
    chargeUnit === 'job'
      ? priceN
      : chargeUnit === 'copy'
        ? priceN * copiesN
        : priceN * pagesN * copiesN;
  const extras = Math.max(0, Number(extraFees) || 0);
  const discountN = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, lineTotal + extras - discountN);
  const paidN = paid.trim() === '' ? total : Math.max(0, Number(paid) || 0);

  const filtered = jobs.filter((j) =>
    `${j.receiptNo} ${j.customerName || ''} ${j.description || ''} ${j.serviceName || ''}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );

  const stats = useMemo(() => {
    const income = jobs.reduce((s, j) => s + Number(j.total), 0);
    const collected = jobs.reduce((s, j) => s + Number(j.paid), 0);
    return { count: jobs.length, income, due: Math.max(0, income - collected) };
  }, [jobs]);

  function printJob(job: Receipt) {
    const w = window.open('', '_blank', 'width=800,height=700');
    if (!w) {
      setNotice('اسمح بالنوافذ المنبثقة لإتمام الطباعة.');
      return;
    }
    const serviceTitle = job.serviceName || 'خدمة';
    const hasPrintMeta =
      job.pages > 1 ||
      job.copies > 1 ||
      (job.paperSize && job.paperSize !== '—') ||
      Boolean(job.colorMode && job.colorMode !== '—');
    const printRows = hasPrintMeta
      ? `<tr><td>المقاس / اللون</td><td>${escapeHtml(job.paperSize || '—')} / ${
          job.colorMode === 'color' ? 'ألوان' : job.colorMode === 'bw' ? 'أبيض وأسود' : escapeHtml(String(job.colorMode || '—'))
        }</td></tr>
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
<tr><td>سعر الوحدة</td><td>${Number(job.unitPrice).toFixed(2)} ج.م</td></tr>
<tr><td>رسوم إضافية</td><td>${Number(job.extraFees).toFixed(2)} ج.م</td></tr>
<tr><td>الخصم</td><td>${Number(job.discount).toFixed(2)} ج.م</td></tr>
<tr><td class="total">الإجمالي</td><td class="total">${Number(job.total).toFixed(2)} ج.م</td></tr>
<tr><td>المدفوع</td><td>${Number(job.paid).toFixed(2)} ج.م</td></tr>
<tr><td>المتبقي</td><td>${(Number(job.total) - Number(job.paid)).toFixed(2)} ج.م</td></tr>
</table>
${job.notes ? `<p>ملاحظات: ${escapeHtml(job.notes)}</p>` : ''}
<div class="line"></div>
<p style="text-align:center">شكرًا لثقتكم بنا</p>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
    w.document.close();
  }

  async function saveJob() {
    if (!receiptNo.trim()) {
      setNotice('اكتب رقم الإيصال.');
      return;
    }
    if (!selected) {
      setNotice('أضف خدمة واحدة على الأقل من تبويب الخدمات.');
      return;
    }
    const usePrintMeta = showPrintDetails || chargeUnit === 'page' || chargeUnit === 'copy';
    setBusy(true);
    setNotice('');
    try {
      const job = await apiRequest<Receipt>('/service-receipts', {
        method: 'POST',
        body: JSON.stringify({
          receiptNo: receiptNo.trim(),
          receiptDate: date,
          customerName: customerName.trim() || undefined,
          serviceId: selected.id,
          serviceName: selected.name,
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
          paidAmount: Math.min(total, paidN),
          notes: notes.trim() || undefined,
        }),
      });
      setNotice(
        `تم حفظ الإيصال ${job.receiptNo}` +
          (job.paid > 0 ? ' وتسجيل المبلغ في الخزينة.' : '.'),
      );
      setReceiptNo(makeReceiptNo());
      setCustomerName('');
      setDescription('');
      setPages('1');
      setCopies('1');
      setExtraFees('0');
      setDiscount('0');
      setPaid('');
      setNotes('');
      await loadAll();
      printJob(job);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حفظ الإيصال.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteJob(job: Receipt) {
    if (!confirm(`حذف الإيصال ${job.receiptNo}؟\nسيتم إلغاء قيده من الخزينة إن وُجد.`)) return;
    setBusy(true);
    try {
      await apiRequest(`/service-receipts/${job.id}`, { method: 'DELETE' });
      setNotice(`تم حذف ${job.receiptNo}.`);
      await loadAll();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحذف.');
    } finally {
      setBusy(false);
    }
  }

  async function saveService() {
    const name = editName.trim();
    const price = Number(editPrice);
    if (!name || !Number.isFinite(price) || price < 0) {
      setNotice('أدخل اسم الخدمة وسعرًا صحيحًا.');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await apiRequest(`/services/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, unitPrice: price, chargeUnit: editUnit }),
        });
        setNotice('تم تحديث الخدمة على الخادم.');
      } else {
        await apiRequest('/services', {
          method: 'POST',
          body: JSON.stringify({ name, unitPrice: price, chargeUnit: editUnit }),
        });
        setNotice('تم إضافة الخدمة على الخادم.');
      }
      setEditName('');
      setEditPrice('');
      setEditUnit('job');
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حفظ الخدمة.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPrice(String(s.unitPrice));
    setEditUnit(s.chargeUnit);
    setTab('services');
  }

  async function toggleActive(s: Service) {
    setBusy(true);
    try {
      await apiRequest(`/services/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !s.active }),
      });
      await loadAll();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر التحديث.');
    } finally {
      setBusy(false);
    }
  }

  async function removeService(s: Service) {
    if (!confirm(`حذف الخدمة «${s.name}»؟`)) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ deactivated?: boolean }>(`/services/${s.id}`, { method: 'DELETE' });
      if (serviceId === s.id) setServiceId('');
      setNotice(res.deactivated ? 'تم تعطيل الخدمة لارتباطها بإيصالات.' : 'تم حذف الخدمة.');
      await loadAll();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحذف.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">مركز الخدمات</span>
          <h1>الخدمات والإيصالات</h1>
          <p>محفوظة على الخادم · المدفوع يُسجَّل تلقائيًا في الخزينة · مرتبطة بالمكتبة</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void loadAll()}>
          <IconRefresh size={16} />
          <span>تحديث</span>
        </button>
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

      <div className="pur-stats">
        <div className="pur-stat">
          <span className="pur-stat-icon">
            <IconReceipt size={18} />
          </span>
          <div>
            <div className="label">الإيصالات</div>
            <div className="value">{stats.count}</div>
          </div>
        </div>
        <div className="pur-stat">
          <span className="pur-stat-icon">
            <IconPrint size={18} />
          </span>
          <div>
            <div className="label">إجمالي الخدمات</div>
            <div className="value" style={{ fontSize: 18 }}>
              {money(stats.income)}
            </div>
          </div>
        </div>
        <div className="pur-stat">
          <span className="pur-stat-icon">
            <IconWallet size={18} />
          </span>
          <div>
            <div className="label">المتبقي للتحصيل</div>
            <div className="value" style={{ fontSize: 18, color: stats.due > 0 ? '#b45309' : undefined }}>
              {money(stats.due)}
            </div>
          </div>
        </div>
      </div>

      <div className="pur-tabs" role="tablist">
        <button type="button" className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}>
          <IconReceipt size={16} />
          <span>إيصال جديد</span>
        </button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          <IconPrint size={16} />
          <span>سجل الإيصالات</span>
        </button>
        <button type="button" className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>
          <IconWallet size={16} />
          <span>الخدمات والأسعار</span>
        </button>
      </div>

      {loading && <div className="empty-state">جارٍ التحميل من الخادم...</div>}

      {tab === 'services' && !loading && (
        <section className="purchase-panel">
          <div className="panel-heading">
            <div>
              <h2>إدارة الخدمات</h2>
              <p>تُحفظ على PostgreSQL لكل مكتبة. عند أول فتح تُنشأ خدمات افتراضية.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label className="pur-field">
              اسم الخدمة
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="تجليد / تصوير / بحث..." />
            </label>
            <label className="pur-field">
              السعر (ج.م)
              <input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
            </label>
            <label className="pur-field">
              طريقة الحساب
              <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as ChargeUnit)}>
                <option value="job">سعر ثابت للخدمة</option>
                <option value="page">حسب الصفحة (صفحات × نسخ × السعر)</option>
                <option value="copy">حسب النسخة</option>
              </select>
            </label>
          </div>
          <div className="pur-footer-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <button className="primary-btn" type="button" disabled={busy} onClick={() => void saveService()}>
              {editingId ? 'حفظ التعديل' : 'إضافة خدمة'}
            </button>
            {editingId && (
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditName('');
                  setEditPrice('');
                  setEditUnit('job');
                }}
              >
                إلغاء
              </button>
            )}
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>الخدمة</th>
                  <th>السعر</th>
                  <th>الحساب</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                    <td>{s.name}</td>
                    <td>{money(s.unitPrice)}</td>
                    <td>{unitLabel(s.chargeUnit)}</td>
                    <td>{s.active ? <span className="tag synced">نشط</span> : <span className="tag local">معطّل</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="secondary-btn small" type="button" onClick={() => startEdit(s)}>
                          تعديل
                        </button>
                        <button className="secondary-btn small" type="button" onClick={() => void toggleActive(s)}>
                          {s.active ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button className="danger-outline-btn small" type="button" onClick={() => void removeService(s)}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'new' && !loading && (
        <section className="purchase-panel pur-invoice">
          <div className="panel-heading">
            <div>
              <h2>إيصال خدمة جديد</h2>
              <p>عند الحفظ مع مبلغ مدفوع يُقيَّد تلقائيًا في الخزينة (فئة: خدمات).</p>
            </div>
          </div>
          <div className="pur-section">
            <div className="pur-section-title">بيانات الإيصال</div>
            <div className="settings-form-grid">
              <label className="pur-field">
                رقم الإيصال
                <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} dir="ltr" />
              </label>
              <label className="pur-field">
                التاريخ
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="pur-field">
                العميل
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="عميل نقدي" />
              </label>
              <label className="pur-field">
                الخدمة
                <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {money(s.unitPrice)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pur-field" style={{ gridColumn: '1 / -1' }}>
                الوصف
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="اختياري" />
              </label>
            </div>
          </div>

          <div className="pur-section">
            <div className="pur-section-title">
              التفاصيل{' '}
              <button
                type="button"
                className="secondary-btn small"
                style={{ marginInlineStart: 8 }}
                onClick={() => setShowPrintDetails((v) => !v)}
              >
                {showPrintDetails ? 'إخفاء' : 'إظهار'} صفحات/نسخ
              </button>
            </div>
            {(showPrintDetails || chargeUnit === 'page' || chargeUnit === 'copy') && (
              <div className="settings-form-grid">
                <label className="pur-field">
                  المقاس
                  <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                    <option>A4</option>
                    <option>A3</option>
                    <option>A5</option>
                    <option>Letter</option>
                  </select>
                </label>
                <label className="pur-field">
                  اللون
                  <select value={colorMode} onChange={(e) => setColorMode(e.target.value as 'bw' | 'color')}>
                    <option value="bw">أبيض وأسود</option>
                    <option value="color">ألوان</option>
                  </select>
                </label>
                <label className="pur-field">
                  صفحات
                  <input type="number" min={1} value={pages} onChange={(e) => setPages(e.target.value)} />
                </label>
                <label className="pur-field">
                  نسخ
                  <input type="number" min={1} value={copies} onChange={(e) => setCopies(e.target.value)} />
                </label>
                <label className="pur-field">
                  الوجه
                  <select value={sides} onChange={(e) => setSides(e.target.value as 'single' | 'double')}>
                    <option value="single">وجه واحد</option>
                    <option value="double">وجهين</option>
                  </select>
                </label>
              </div>
            )}
            <div className="settings-form-grid" style={{ marginTop: 12 }}>
              <label className="pur-field">
                سعر الوحدة
                <input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              </label>
              <label className="pur-field">
                رسوم إضافية
                <input type="number" min={0} step="0.01" value={extraFees} onChange={(e) => setExtraFees(e.target.value)} />
              </label>
              <label className="pur-field">
                خصم
                <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </label>
              <label className="pur-field">
                المدفوع (فارغ = كامل)
                <input type="number" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total)} />
              </label>
              <label className="pur-field" style={{ gridColumn: '1 / -1' }}>
                ملاحظات
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="pur-footer">
            <div className="pur-footer-fields">
              <div className="sale-total-item">
                <span>طريقة الحساب</span>
                <strong style={{ fontSize: 13 }}>{unitLabel(chargeUnit)}</strong>
              </div>
            </div>
            <div className="pur-footer-summary">
              <div className="pur-total-box">
                <span>الإجمالي</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="pur-footer-actions">
                <button className="primary-btn" type="button" disabled={busy} onClick={() => void saveJob()}>
                  حفظ وطباعة
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'history' && !loading && (
        <section className="purchase-panel">
          <div className="panel-heading">
            <div>
              <h2>سجل الإيصالات</h2>
              <p>من الخادم — الحذف يلغي قيد الخزينة المرتبط.</p>
            </div>
            <span className="count-badge">{filtered.length}</span>
          </div>
          <div className="filter-bar">
            <label className="grow">
              بحث
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="رقم / عميل / خدمة" />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الإيصال</th>
                  <th>التاريخ</th>
                  <th>العميل</th>
                  <th>الخدمة</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>خزينة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td dir="ltr">{j.receiptNo}</td>
                    <td>{j.date}</td>
                    <td>{j.customerName || '—'}</td>
                    <td>{j.serviceName}</td>
                    <td>{money(j.total)}</td>
                    <td>{money(j.paid)}</td>
                    <td>
                      {j.cashTransactionId ? (
                        <span className="tag synced">مقيّد</span>
                      ) : (
                        <span className="tag local">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="secondary-btn small" type="button" onClick={() => printJob(j)}>
                          طباعة
                        </button>
                        <button className="danger-outline-btn small" type="button" onClick={() => void deleteJob(j)}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty-state">لا إيصالات بعد.</div>}
          </div>
        </section>
      )}
    </div>
  );
}
