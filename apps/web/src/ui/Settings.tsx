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
    setNotice('تم حفظ إعدادات الفاتورة.');
  }

  function handleResetInvoice() {
    if (!confirm('استعادة القيم الافتراضية لإعدادات الفاتورة؟')) return;
    const defaults = resetInvoiceSettings();
    setForm(defaults);
    setTagsText(defaults.serviceTags.join('\n'));
    setNotice('تمت الاستعادة للقيم الافتراضية.');
  }

  async function removeLocalOrg(org: LocalOrganization) {
    if (!confirm(`إزالة «${org.name}» من قائمة هذا الجهاز فقط؟`)) return;
    await db.organizations.delete(org.id);
    await refreshLocal();
    setNotice(`تمت إزالة «${org.name}» من الجهاز.`);
  }

  async function deleteServerOrganization() {
    if (!isOwner || !sessionOrg) return;
    if (confirmSlug.trim() !== sessionOrg.slug) {
      setNotice(`للتأكيد اكتب المعرّف: ${sessionOrg.slug}`);
      return;
    }
    if (
      !confirm(`تحذير: حذف «${sessionOrg.name}» من الخادم نهائيًا مع كل البيانات؟`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiRequest('/auth/organization', {
        method: 'DELETE',
        body: JSON.stringify({ confirmSlug: confirmSlug.trim() }),
      });
      await db.organizations.delete(sessionOrg.id);
      clearSession();
      window.location.reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر حذف المكتبة.');
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'users', label: 'المستخدمون', show: isOwner },
    { id: 'invoice', label: 'الفاتورة', show: true },
    { id: 'libraries', label: 'المكتبات على الجهاز', show: true },
    { id: 'danger', label: 'حذف المكتبة', show: isOwner },
  ];

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">التحكم</span>
          <h1>الإعدادات</h1>
          <p>
            {sessionOrg?.name ? (
              <>
                {sessionOrg.name}
                {sessionUser ? ` · ${sessionUser.fullName}` : ''}
              </>
            ) : (
              'إعدادات النظام والحسابات'
            )}
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
              className={tab === t.id ? 'active' : ''}
              onClick={() => {
                setTab(t.id);
                setNotice('');
              }}
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
                <h2>بيانات الفاتورة المطبوعة</h2>
                <p>تظهر في رأس وتذييل فاتورة البيع.</p>
              </div>
            </div>
            <div className="purchase-form-grid">
              <label>
                عنوان المركز
                <input value={form.brandTitle} onChange={(e) => update('brandTitle', e.target.value)} />
              </label>
              <label>
                السطر التوضيحي
                <input value={form.brandSubtitle} onChange={(e) => update('brandSubtitle', e.target.value)} />
              </label>
              <label>
                تليفون / واتساب
                <input value={form.phone} onChange={(e) => update('phone', e.target.value)} dir="ltr" />
              </label>
              <label>
                العنوان
                <input value={form.address} onChange={(e) => update('address', e.target.value)} />
              </label>
              <label>
                عنوان الفاتورة
                <input value={form.invoiceTitle} onChange={(e) => update('invoiceTitle', e.target.value)} />
              </label>
              <label>
                نص العلامة المائية
                <input value={form.watermarkText} onChange={(e) => update('watermarkText', e.target.value)} />
              </label>
              <label>
                تذييل الفاتورة
                <input value={form.footerText} onChange={(e) => update('footerText', e.target.value)} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                وسوم الخدمات (سطر لكل وسم)
                <textarea
                  rows={4}
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  style={{ width: '100%', border: '1px solid #dbe5e5', borderRadius: 8, padding: 10 }}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-btn" type="button" onClick={handleSaveInvoice}>
                حفظ إعدادات الفاتورة
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
                <h2>المكتبات على هذا الجهاز</h2>
                <p>مرجع محلي فقط — لا يحذف بيانات الخادم.</p>
              </div>
              <span className="count-badge">{organizations.length}</span>
            </div>
            {organizations.length === 0 ? (
              <div className="empty-state">لا مكتبات محفوظة على الجهاز.</div>
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
                    {organizations.map((org) => (
                      <tr key={org.id}>
                        <td>
                          {org.name}
                          {sessionOrg?.id === org.id ? (
                            <span className="tag synced" style={{ marginInlineStart: 8 }}>
                              الحالية
                            </span>
                          ) : null}
                        </td>
                        <td dir="ltr">{org.slug}</td>
                        <td dir="ltr">{org.phone || '—'}</td>
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
                    ))}
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
                <h2>حذف المكتبة من الخادم</h2>
                <p>
                  للمالك فقط. يحذف «{sessionOrg.name}» وكل الفواتير والمستخدمين. لا يمكن التراجع.
                </p>
              </div>
            </div>
            <div className="inline-form" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
              <label>
                اكتب المعرّف (<span dir="ltr">{sessionOrg.slug}</span>)
                <input
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  dir="ltr"
                  placeholder={sessionOrg.slug}
                />
              </label>
              <button
                className="danger-outline-btn"
                type="button"
                disabled={busy}
                onClick={() => void deleteServerOrganization()}
              >
                حذف نهائي من الخادم
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
