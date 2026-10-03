import { useCallback, useEffect, useState } from 'react';
import {
  loadInvoiceSettings,
  resetInvoiceSettings,
  saveInvoiceSettings,
  type InvoiceSettings,
} from '../data/invoiceSettings';
import { db, type LocalOrganization } from '../data/db';
import {
  apiRequest,
  clearSession,
  getStoredOrganization,
  getStoredUser,
} from '../data/api';
import { AdminUsers } from './AdminUsers';

type Tab = 'invoice' | 'users' | 'libraries' | 'danger';

export function Settings() {
  const sessionUser = getStoredUser();
  const sessionOrg = getStoredOrganization();
  const isOwner = sessionUser?.role === 'OWNER';

  const [tab, setTab] = useState<Tab>(isOwner ? 'users' : 'invoice');
  const [form, setForm] = useState<InvoiceSettings>(() => loadInvoiceSettings());
  const [tagsText, setTagsText] = useState(() => loadInvoiceSettings().serviceTags.join('\n'));
  const [notice, setNotice] = useState('');
  const [organizations, setOrganizations] = useState<LocalOrganization[]>([]);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshLocal = useCallback(async () => {
    setOrganizations(await db.organizations.orderBy('updatedAt').reverse().toArray());
  }, []);

  useEffect(() => {
    void refreshLocal();
  }, [refreshLocal]);

  function update<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function handleSaveInvoice() {
    const tags = tagsText
      .split(/\n|,/)
      .map((t) => t.trim())
      .filter(Boolean);
    const next: InvoiceSettings = { ...form, serviceTags: tags };
    saveInvoiceSettings(next);
    setForm(loadInvoiceSettings());
    setTagsText(loadInvoiceSettings().serviceTags.join('\n'));
    setNotice('تم حفظ بيانات الطباعة والإيصالات على هذا الجهاز.');
  }

  function handleResetInvoice() {
    if (!confirm('استعادة القيم الافتراضية لبيانات الطباعة على هذا الجهاز؟')) return;
    const defaults = resetInvoiceSettings();
    setForm(defaults);
    setTagsText(defaults.serviceTags.join('\n'));
    setNotice('تمت استعادة القيم الافتراضية.');
  }

  async function removeLocalOrg(org: LocalOrganization) {
    const isCurrent = sessionOrg?.slug === org.slug;
    if (
      !confirm(
        isCurrent
          ? `إزالة «${org.name}» من قائمة هذا الجهاز؟\nلن تُحذف من الخادم، وستبقى مسجّل الدخول حتى تضغط تسجيل الخروج.`
          : `إزالة «${org.name}» من قائمة هذا الجهاز فقط؟ (لا يحذف بيانات الخادم)`,
      )
    ) {
      return;
    }
    await db.organizations.delete(org.id);
    await refreshLocal();
    setNotice(`تمت إزالة «${org.name}» من قائمة الجهاز.`);
  }

  async function deleteServerOrganization() {
    if (!isOwner || !sessionOrg) return;
    if (confirmSlug.trim() !== sessionOrg.slug) {
      setNotice(`للتأكيد اكتب المعرّف بالضبط: ${sessionOrg.slug}`);
      return;
    }
    if (
      !confirm(
        `تحذير نهائي: سيتم حذف «${sessionOrg.name}» من الخادم مع كل الفواتير والمخزون والمبيعات والمستخدمين. لا يمكن التراجع.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await apiRequest('/auth/organization', {
        method: 'DELETE',
        body: JSON.stringify({ confirmSlug: confirmSlug.trim() }),
      });
      // إزالة كل النسخ المحلية بنفس المعرّف (المعرّف المحلي قد يختلف عن id الخادم)
      const local = await db.organizations.where('slug').equals(sessionOrg.slug).toArray();
      for (const row of local) {
        await db.organizations.delete(row.id);
      }
      clearSession();
      window.location.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حذف المكتبة من الخادم.');
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'users', label: 'الحسابات والصلاحيات', show: isOwner },
    { id: 'invoice', label: 'الطباعة والإيصالات', show: true },
    { id: 'libraries', label: 'هذا الجهاز', show: true },
    { id: 'danger', label: 'حذف نهائي', show: isOwner },
  ];

  function switchTab(id: Tab) {
    setTab(id);
    setNotice('');
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">النظام</span>
          <h1>الإعدادات</h1>
          <p>
            {sessionOrg
              ? `الحسابات، بيانات الطباعة، والمراجع المحلية — ${sessionOrg.name}`
              : 'الحسابات وبيانات الطباعة والمراجع على الجهاز'}
            {sessionUser ? ` · ${sessionUser.fullName}` : ''}
          </p>
        </div>
      </div>

      {notice && (
        <div className="purchase-notice" role="status">
          {notice}
        </div>
      )}

      <div className="settings-tabs" role="tablist">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === 'users' && isOwner && (
        <div className="settings-tab-panel">
          <AdminUsers embedded />
        </div>
      )}

      {tab === 'invoice' && (
        <div className="settings-tab-panel">
          <section className="purchase-panel">
            <div className="panel-heading">
              <div>
                <h2>بيانات الطباعة والإيصالات</h2>
                <p>
                  تظهر على فواتير البيع والإيصالات المطبوعة. تُحفظ في هذا المتصفح فقط (ليست على
                  الخادم) — إن غيّرت الجهاز أعد ضبطها هنا.
                </p>
              </div>
            </div>
            <div className="purchase-form-grid">
              <label>
                عنوان المركز
                <input
                  value={form.brandTitle}
                  onChange={(e) => update('brandTitle', e.target.value)}
                  placeholder="اسم يظهر أعلى الفاتورة"
                />
              </label>
              <label>
                السطر التوضيحي
                <input
                  value={form.brandSubtitle}
                  onChange={(e) => update('brandSubtitle', e.target.value)}
                  placeholder="نشاط المركز باختصار"
                />
              </label>
              <label>
                تليفون / واتساب
                <input
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                />
              </label>
              <label>
                العنوان
                <input
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="العنوان الظاهر على الفاتورة"
                />
              </label>
              <label>
                عنوان المستند
                <input
                  value={form.invoiceTitle}
                  onChange={(e) => update('invoiceTitle', e.target.value)}
                  placeholder="مثل: فاتورة مبيعات"
                />
              </label>
              <label>
                نص العلامة المائية
                <input
                  value={form.watermarkText}
                  onChange={(e) => update('watermarkText', e.target.value)}
                  placeholder="نص خفيف خلف الفاتورة"
                />
              </label>
              <label>
                تذييل المستند
                <input
                  value={form.footerText}
                  onChange={(e) => update('footerText', e.target.value)}
                  placeholder="شكرًا لثقتكم بنا"
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                وسوم الخدمات (سطر لكل وسم)
                <textarea
                  rows={4}
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder={'خدمات علمية\nتصوير وطباعة'}
                  style={{ width: '100%', border: '1px solid #dbe5e5', borderRadius: 8, padding: 10 }}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-btn" type="button" onClick={handleSaveInvoice}>
                حفظ بيانات الطباعة
              </button>
              <button className="secondary-btn" type="button" onClick={handleResetInvoice}>
                استعادة الافتراضي
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === 'libraries' && (
        <div className="settings-tab-panel">
          <section className="purchase-panel">
            <div className="panel-heading">
              <div>
                <h2>المكتبات المحفوظة على هذا الجهاز</h2>
                <p>
                  مرجع في المتصفح فقط. «إزالة من الجهاز» تمسح الاسم من القائمة المحلية ولا تحذف
                  أي بيانات من الخادم.
                </p>
              </div>
              <span className="count-badge">{organizations.length}</span>
            </div>
            {organizations.length === 0 ? (
              <div className="empty-state">لا مكتبات محفوظة على هذا الجهاز بعد.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>المعرّف</th>
                      <th>الهاتف</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => {
                      const isCurrent = Boolean(sessionOrg?.slug && sessionOrg.slug === org.slug);
                      return (
                        <tr key={org.id}>
                          <td>
                            {org.name}
                            {isCurrent ? (
                              <span className="tag synced" style={{ marginInlineStart: 8 }}>
                                الحالية
                              </span>
                            ) : null}
                          </td>
                          <td dir="ltr">{org.slug}</td>
                          <td dir="ltr">{org.phone?.trim() ? org.phone : '—'}</td>
                          <td>
                            <button
                              className="danger-outline-btn"
                              type="button"
                              onClick={() => void removeLocalOrg(org)}
                            >
                              إزالة من الجهاز
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'danger' && isOwner && sessionOrg && (
        <div className="settings-tab-panel">
          <section className="purchase-panel danger-zone">
            <div className="panel-heading">
              <div>
                <h2>حذف المكتبة نهائيًا من الخادم</h2>
                <p>
                  للمالك فقط. يحذف «{sessionOrg.name}» (
                  <span dir="ltr">{sessionOrg.slug}</span>) وكل الفواتير والمخزون والمبيعات
                  والمستخدمين من قاعدة البيانات. لا يمكن التراجع.
                </p>
              </div>
            </div>
            <div className="inline-form" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
              <label>
                اكتب المعرّف للتأكيد
                <input
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  dir="ltr"
                  placeholder={sessionOrg.slug}
                  autoComplete="off"
                />
              </label>
              <button
                className="danger-outline-btn"
                type="button"
                disabled={busy || confirmSlug.trim() !== sessionOrg.slug}
                onClick={() => void deleteServerOrganization()}
              >
                {busy ? 'جارٍ الحذف...' : 'حذف نهائي من الخادم'}
              </button>
            </div>
            {confirmSlug.trim() && confirmSlug.trim() !== sessionOrg.slug && (
              <p className="muted-sm" style={{ color: '#b42318', marginTop: 8 }}>
                المعرّف غير مطابق. المطلوب: <span dir="ltr">{sessionOrg.slug}</span>
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
