import { useState } from 'react';
import {
  DEFAULT_INVOICE_SETTINGS,
  loadInvoiceSettings,
  resetInvoiceSettings,
  saveInvoiceSettings,
  type InvoiceSettings,
} from '../data/invoiceSettings';

export function Settings() {
  const [form, setForm] = useState<InvoiceSettings>(() => loadInvoiceSettings());
  const [tagsText, setTagsText] = useState(() => loadInvoiceSettings().serviceTags.join('\n'));
  const [notice, setNotice] = useState('');

  function update<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function handleSave() {
    const tags = tagsText
      .split(/\n|,/)
      .map((t) => t.trim())
      .filter(Boolean);
    const next: InvoiceSettings = { ...form, serviceTags: tags };
    saveInvoiceSettings(next);
    setForm(loadInvoiceSettings());
    setTagsText(loadInvoiceSettings().serviceTags.join('\n'));
    setNotice('تم حفظ إعدادات الفاتورة. ستظهر في الطباعة التالية.');
  }

  function handleReset() {
    if (!confirm('استعادة القيم الافتراضية لإعدادات الفاتورة؟')) return;
    const defaults = resetInvoiceSettings();
    setForm(defaults);
    setTagsText(defaults.serviceTags.join('\n'));
    setNotice('تمت الاستعادة للقيم الافتراضية.');
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">التخصيص</span>
          <h1>إعدادات الفاتورة</h1>
          <p>عدّل بيانات الهيدر والعلامة المائية كما تظهر عند طباعة فاتورة المبيعات.</p>
        </div>
      </div>

      {notice && <div className="purchase-notice" role="status">{notice}</div>}

      <section className="purchase-panel">
        <div className="panel-heading">
          <div>
            <h2>بيانات الهيدر</h2>
            <p>الاسم والعنوان ووسائل التواصل الظاهرة أعلى الفاتورة.</p>
          </div>
        </div>
        <div className="purchase-form-grid">
          <label>
            عنوان المركز (السطر الكبير)
            <input value={form.brandTitle} onChange={(e) => update('brandTitle', e.target.value)} placeholder="مركز المهندس" />
          </label>
          <label>
            السطر التوضيحي
            <input value={form.brandSubtitle} onChange={(e) => update('brandSubtitle', e.target.value)} placeholder="للخدمات العلمية والطباعة..." />
          </label>
          <label>
            تليفون / واتساب
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} dir="ltr" placeholder="01127897245" />
          </label>
          <label>
            العنوان
            <input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="العنوان الكامل" />
          </label>
          <label>
            عنوان مستند الفاتورة
            <input value={form.invoiceTitle} onChange={(e) => update('invoiceTitle', e.target.value)} placeholder="فاتورة مبيعات" />
          </label>
          <label>
            نص التذييل
            <input value={form.footerText} onChange={(e) => update('footerText', e.target.value)} placeholder="شكرًا لثقتكم بنا" />
          </label>
        </div>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading">
          <div>
            <h2>العلامة المائية والتصنيفات</h2>
            <p>نص العلامة المائية المكررة، وتصنيفات الخدمات في جانب الهيدر.</p>
          </div>
        </div>
        <div className="purchase-form-grid">
          <label>
            نص العلامة المائية
            <input
              value={form.watermarkText}
              onChange={(e) => update('watermarkText', e.target.value)}
              placeholder="يظهر مكررًا على خلفية الفاتورة"
            />
          </label>
          <label>
            تصنيفات الخدمات (سطر لكل تصنيف)
            <textarea
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              rows={4}
              placeholder={'خدمات علمية\nتصوير وطباعة\nأدوات مكتبية'}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #c5d4ea', fontFamily: 'inherit' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="primary-btn" type="button" onClick={handleSave}>حفظ الإعدادات</button>
          <button className="secondary-btn" type="button" onClick={handleReset}>استعادة الافتراضي</button>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
          الإعدادات تُحفظ على هذا الجهاز. القيم الافتراضية: {DEFAULT_INVOICE_SETTINGS.brandTitle} — {DEFAULT_INVOICE_SETTINGS.phone}
        </p>
      </section>
    </div>
  );
}
