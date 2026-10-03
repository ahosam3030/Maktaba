import { useEffect, useState } from 'react';
import { db, type LocalOrganization } from '../data/db';
import {
  apiHealth,
  apiRequest,
  registerOrganization,
  login,
  saveSession,
  clearSession,
  getToken,
  getStoredUser,
  getStoredOrganization,
  hasPermission,
  isAdminUser,
} from '../data/api';
import { Purchases } from './Purchases';
import { Inventory } from './Inventory';
import { Sales } from './Sales';
import { Printing } from './Printing';
import { Accounting } from './Accounting';
import { AdminUsers } from './AdminUsers';
import { Settings } from './Settings';
import { Reports } from './Reports';

type ConnectionState = 'checking' | 'online' | 'offline';
type AuthMode = 'login' | 'register';

export function App() {
  const [connection, setConnection] = useState<ConnectionState>(navigator.onLine ? 'checking' : 'offline');
  const [apiStatus, setApiStatus] = useState('جارٍ الفحص');
  const [organizations, setOrganizations] = useState<LocalOrganization[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [sessionUser, setSessionUser] = useState(getStoredUser());
  const [sessionOrg, setSessionOrg] = useState(getStoredOrganization());
  const [activeSection, setActiveSection] = useState<
    'dashboard' | 'purchases' | 'inventory' | 'sales' | 'printing' | 'accounting' | 'reports' | 'admin' | 'settings'
  >('dashboard');
  const [confirmSlug, setConfirmSlug] = useState('');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSlug, setDeleteSlug] = useState('');

  const isLoggedIn = Boolean(getToken() && sessionUser);

  async function refreshLocal() {
    setOrganizations(await db.organizations.orderBy('updatedAt').reverse().toArray());
  }

  async function checkApi() {
    if (!navigator.onLine) {
      setConnection('offline');
      setApiStatus('غير متصل');
      return;
    }
    try {
      await apiHealth();
      setConnection('online');
      setApiStatus('متصل');
    } catch {
      setConnection('offline');
      setApiStatus('الخادم غير متاح');
    }
  }

  useEffect(() => {
    void refreshLocal();
    void checkApi();
    const onOnline = () => void checkApi();
    const onOffline = () => {
      setConnection('offline');
      setApiStatus('غير متصل');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function handleRegister() {
    if (!name.trim() || !slug.trim() || !ownerName.trim() || !email.trim() || password.length < 10) {
      setMessage('أكمل البيانات. كلمة المرور 10 أحرف على الأقل.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await registerOrganization({
        organizationName: name.trim(),
        slug: slug.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        fullName: ownerName.trim(),
        email: email.trim(),
        password,
      });
      saveSession(result);
      setSessionUser(result.user);
      setSessionOrg(result.organization);
      await db.organizations.put({
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        phone: phone.trim() || undefined,
        localOnly: false,
        updatedAt: new Date().toISOString(),
      });
      await refreshLocal();
      setMessage(`تم إنشاء «${result.organization.name}» بنجاح.`);
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء الحساب.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword) {
      setMessage('أدخل البريد وكلمة المرور.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await login(loginEmail.trim(), loginPassword);
      saveSession(result);
      setSessionUser(result.user);
      setSessionOrg(result.organization);
      await db.organizations.put({
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        localOnly: false,
        updatedAt: new Date().toISOString(),
      });
      await refreshLocal();
      setMessage(`مرحبًا ${result.user.fullName}`);
      setLoginPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSessionUser(null);
    setSessionOrg(null);
    setMessage('تم تسجيل الخروج.');
    setActiveSection('dashboard');
  }

  async function removeLocalOrg(org: LocalOrganization) {
    if (!confirm(`إزالة «${org.name}» من قائمة هذا الجهاز فقط؟\n(لا يحذف بيانات الخادم)`)) return;
    await db.organizations.delete(org.id);
    await refreshLocal();
    setMessage(`تمت إزالة «${org.name}» من الجهاز.`);
  }

  async function deleteAccountFromLogin() {
    if (!deleteEmail.trim() || !deletePassword || !deleteSlug.trim()) {
      setMessage('أدخل البريد وكلمة المرور ومعرّف المكتبة.');
      return;
    }
    if (
      !confirm(
        `سيتم حذف المكتبة ذات المعرّف «${deleteSlug.trim()}» وكل بياناتها نهائيًا من الخادم. هل أنت متأكد؟`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await apiRequest<{ name: string; deleted: string }>('/auth/delete-organization', {
        method: 'POST',
        body: JSON.stringify({
          email: deleteEmail.trim(),
          password: deletePassword,
          confirmSlug: deleteSlug.trim(),
        }),
      });
      // إزالة من القائمة المحلية إن وُجدت
      const local = await db.organizations.where('slug').equals(res.deleted).toArray();
      for (const row of local) await db.organizations.delete(row.id);
      await refreshLocal();
      setDeletePassword('');
      setDeleteSlug('');
      setShowDeleteAccount(false);
      setMessage(`تم حذف مكتبة «${res.name}» من الخادم نهائيًا.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'تعذر حذف الحساب.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteServerOrganization() {
    if (!sessionOrg || sessionUser?.role !== 'OWNER') {
      setMessage('حذف المكتبة من الخادم متاح للمالك فقط.');
      return;
    }
    if (confirmSlug.trim() !== sessionOrg.slug) {
      setMessage(`للتأكيد اكتب المعرّف: ${sessionOrg.slug}`);
      return;
    }
    if (
      !confirm(
        `تحذير نهائي: سيتم حذف مكتبة «${sessionOrg.name}» وكل فواتيرها ومخزونها ومبيعاتها ومستخدمينها نهائيًا. هل أنت متأكد؟`,
      )
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
      setSessionUser(null);
      setSessionOrg(null);
      setConfirmSlug('');
      await refreshLocal();
      setMessage('تم حذف المكتبة من الخادم نهائيًا.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'تعذر حذف المكتبة.');
    } finally {
      setBusy(false);
    }
  }

  const roleLabel =
    sessionUser?.role === 'OWNER' ? 'مالك' : sessionUser?.role === 'ADMIN' ? 'أدمن' : 'مستخدم';

  const quickLinks: Array<{ key: typeof activeSection; label: string; desc: string; show: boolean }> = [
    { key: 'purchases', label: 'المشتريات', desc: 'فواتير الوارد والموردين', show: hasPermission(sessionUser, 'purchases') },
    { key: 'sales', label: 'المبيعات', desc: 'نقطة البيع والفواتير', show: hasPermission(sessionUser, 'sales') },
    { key: 'inventory', label: 'المخزون', desc: 'الأرصدة والتسويات', show: hasPermission(sessionUser, 'inventory') },
    { key: 'accounting', label: 'الخزينة', desc: 'الوارد والمنصرف', show: hasPermission(sessionUser, 'accounting') },
    { key: 'reports', label: 'التقارير', desc: 'الأرباح ورأس المال', show: hasPermission(sessionUser, 'reports') },
    { key: 'printing', label: 'الخدمات', desc: 'الخدمات والإيصالات', show: hasPermission(sessionUser, 'printing') },
    { key: 'admin', label: 'المستخدمون', desc: 'الصلاحيات والحسابات', show: isAdminUser(sessionUser) },
    { key: 'settings', label: 'الإعدادات', desc: 'شكل الفاتورة', show: isLoggedIn },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">م</div>
          <div className="brand-copy">
            <strong>إدارة المكتبات</strong>
            <span>نظام تجاري</span>
          </div>
        </div>
        <nav className="side-nav">
          <a
            className={activeSection === 'dashboard' ? 'active' : ''}
            href="#dashboard"
            onClick={() => setActiveSection('dashboard')}
          >
            الرئيسية
          </a>
          {hasPermission(sessionUser, 'purchases') && (
            <a
              className={activeSection === 'purchases' ? 'active' : ''}
              href="#purchases"
              onClick={() => setActiveSection('purchases')}
            >
              المشتريات
            </a>
          )}
          {hasPermission(sessionUser, 'sales') && (
            <a
              className={activeSection === 'sales' ? 'active' : ''}
              href="#sales"
              onClick={() => setActiveSection('sales')}
            >
              المبيعات
            </a>
          )}
          {hasPermission(sessionUser, 'inventory') && (
            <a
              className={activeSection === 'inventory' ? 'active' : ''}
              href="#inventory"
              onClick={() => setActiveSection('inventory')}
            >
              المخزون
            </a>
          )}
          {hasPermission(sessionUser, 'accounting') && (
            <a
              className={activeSection === 'accounting' ? 'active' : ''}
              href="#accounting"
              onClick={() => setActiveSection('accounting')}
            >
              الخزينة
            </a>
          )}
          {hasPermission(sessionUser, 'reports') && (
            <a
              className={activeSection === 'reports' ? 'active' : ''}
              href="#reports"
              onClick={() => setActiveSection('reports')}
            >
              التقارير
            </a>
          )}
          {hasPermission(sessionUser, 'printing') && (
            <a
              className={activeSection === 'printing' ? 'active' : ''}
              href="#printing"
              onClick={() => setActiveSection('printing')}
            >
              الخدمات والإيصالات
            </a>
          )}
          {isAdminUser(sessionUser) && (
            <a
              className={activeSection === 'admin' ? 'active' : ''}
              href="#admin"
              onClick={() => setActiveSection('admin')}
            >
              المستخدمون
            </a>
          )}
          {isLoggedIn && (
            <a
              className={activeSection === 'settings' ? 'active' : ''}
              href="#settings"
              onClick={() => setActiveSection('settings')}
            >
              إعدادات الفاتورة
            </a>
          )}
        </nav>
        <div className="sidebar-footer">
          {isLoggedIn && sessionUser ? (
            <>
              <div className="user-chip">
                <strong>{sessionUser.fullName}</strong>
                <span>{sessionOrg?.name}</span>
                <span className="role-pill">{roleLabel}</span>
              </div>
              <button type="button" className="secondary-btn small" style={{ width: '100%' }} onClick={handleLogout}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <span className="muted-sm">سجّل الدخول للمتابعة</span>
          )}
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <div className="topbar">
          <h1 className="page-title">
            {activeSection === 'dashboard'
              ? isLoggedIn
                ? 'لوحة التحكم'
                : 'تسجيل الدخول'
              : activeSection === 'purchases'
                ? 'المشتريات'
                : activeSection === 'sales'
                  ? 'المبيعات'
                  : activeSection === 'inventory'
                    ? 'المخزون'
                    : activeSection === 'accounting'
                      ? 'الخزينة'
                      : activeSection === 'reports'
                        ? 'التقارير'
                        : activeSection === 'printing'
                          ? 'الخدمات'
                          : activeSection === 'admin'
                            ? 'المستخدمون'
                            : activeSection === 'settings'
                              ? 'الإعدادات'
                              : 'لوحة التحكم'}
          </h1>
          <div className="status-pills">
            <span className={`pill ${connection === 'online' ? 'ok' : connection === 'checking' ? 'warn' : 'bad'}`}>
              {connection === 'online' ? 'الخادم متصل' : connection === 'checking' ? 'فحص الاتصال' : 'الخادم غير متاح'}
            </span>
            <span className={`pill ${isLoggedIn ? 'ok' : 'warn'}`}>
              {isLoggedIn ? 'مسجّل الدخول' : 'غير مسجّل'}
            </span>
            <span className="pill muted">{apiStatus}</span>
          </div>
        </div>

        {activeSection === 'dashboard' && !isLoggedIn && (
          <div className="auth-layout">
            <section className="auth-hero">
              <p className="eyebrow">نظام إدارة المكتبات والطباعة</p>
              <h2>كل عمليات مكتبتك في مكان واحد</h2>
              <ul className="auth-features">
                <li>مشتريات ومخزون ومبيعات مترابطة</li>
                <li>خزينة وتقارير أرباح ورأس مال</li>
                <li>صلاحيات للمستخدمين حسب القسم</li>
                <li>فواتير وإيصالات قابلة للطباعة</li>
              </ul>
            </section>

            <section className="auth-card">
              <div className="auth-tabs">
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('login');
                    setMessage('');
                  }}
                >
                  دخول
                </button>
                <button
                  type="button"
                  className={authMode === 'register' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('register');
                    setMessage('');
                  }}
                >
                  تسجيل مكتبة جديدة
                </button>
              </div>

              {authMode === 'login' ? (
                <>
                  <h3>تسجيل الدخول</h3>
                  <p className="muted-sm">أدخل بريدك وكلمة المرور للوصول إلى بيانات مكتبتك.</p>
                  <div className="form-grid auth-form">
                    <label>
                      البريد الإلكتروني
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        dir="ltr"
                        placeholder="name@example.com"
                        autoComplete="username"
                      />
                    </label>
                    <label>
                      كلمة المرور
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        dir="ltr"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleLogin();
                        }}
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="primary-btn" type="button" onClick={() => void handleLogin()} disabled={busy}>
                      {busy ? 'جارٍ الدخول...' : 'دخول'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3>إنشاء حساب مكتبة</h3>
                  <p className="muted-sm">بيانات المكتبة وحساب المالك. كلمة المرور 10 أحرف على الأقل.</p>
                  <div className="form-grid auth-form">
                    <label>
                      اسم المكتبة
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المكتبة" />
                    </label>
                    <label>
                      المعرّف المختصر
                      <input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        dir="ltr"
                        placeholder="library-name"
                      />
                      <small>إنجليزي وأرقام وشرطة فقط</small>
                    </label>
                    <label>
                      الهاتف
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
                    </label>
                    <label>
                      اسم المالك
                      <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="الاسم بالكامل" />
                    </label>
                    <label>
                      البريد
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        dir="ltr"
                        placeholder="name@example.com"
                      />
                    </label>
                    <label>
                      كلمة المرور
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        dir="ltr"
                        minLength={10}
                        placeholder="10 أحرف على الأقل"
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="primary-btn" type="button" onClick={() => void handleRegister()} disabled={busy}>
                      {busy ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
                    </button>
                  </div>
                </>
              )}
              {message && (
                <p className="feedback" role="status">
                  {message}
                </p>
              )}

              <div className="auth-danger-link">
                <button
                  type="button"
                  className="link-danger"
                  onClick={() => {
                    setShowDeleteAccount((v) => !v);
                    setDeleteEmail(loginEmail);
                    setMessage('');
                  }}
                >
                  {showDeleteAccount ? 'إخفاء حذف الحساب' : 'حذف مكتبتي من الخادم…'}
                </button>
              </div>

              {showDeleteAccount && (
                <div className="auth-delete-box">
                  <h4>حذف نهائي من الخادم</h4>
                  <p className="muted-sm">
                    للمالك فقط. يلزم البريد وكلمة المرور ومعرّف المكتبة. لا يمكن التراجع. المستخدمون العاديون لا
                    يستطيعون الحذف.
                  </p>
                  <div className="form-grid auth-form">
                    <label>
                      البريد
                      <input
                        type="email"
                        value={deleteEmail}
                        onChange={(e) => setDeleteEmail(e.target.value)}
                        dir="ltr"
                      />
                    </label>
                    <label>
                      كلمة المرور
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        dir="ltr"
                      />
                    </label>
                    <label>
                      معرّف المكتبة للتأكيد
                      <input
                        value={deleteSlug}
                        onChange={(e) => setDeleteSlug(e.target.value)}
                        dir="ltr"
                        placeholder="مثل: al-mohandes"
                      />
                    </label>
                  </div>
                  <button
                    className="danger-outline-btn"
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteAccountFromLogin()}
                  >
                    تأكيد الحذف النهائي
                  </button>
                </div>
              )}
            </section>

            {organizations.length > 0 && (
              <section className="panel auth-local-list">
                <div className="panel-heading">
                  <div>
                    <h2>مكتبات على هذا الجهاز</h2>
                    <p>مرجع محلي فقط — «إزالة من الجهاز» لا يحذف حساب الخادم. الحذف النهائي من النموذج أعلاه.</p>
                  </div>
                  <span className="count-badge">{organizations.length}</span>
                </div>
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
                          <td>{org.name}</td>
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
              </section>
            )}
          </div>
        )}

        {activeSection === 'dashboard' && isLoggedIn && (
          <div className="home-dashboard">
            {message && (
              <div className="purchase-notice" role="status">
                {message}
              </div>
            )}

            <section className="welcome-banner">
              <div>
                <p className="eyebrow">مرحبًا</p>
                <h2>{sessionUser?.fullName}</h2>
                <p>
                  {sessionOrg?.name}
                  {sessionOrg?.slug ? (
                    <>
                      {' '}
                      · <span dir="ltr">{sessionOrg.slug}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="welcome-meta">
                <span className="role-pill">{roleLabel}</span>
                <span className={`pill ${connection === 'online' ? 'ok' : 'bad'}`}>
                  {connection === 'online' ? 'قاعدة البيانات جاهزة' : 'تحقق من تشغيل الخادم'}
                </span>
              </div>
            </section>

            <section className="quick-grid">
              {quickLinks
                .filter((l) => l.show)
                .map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    className="quick-card"
                    onClick={() => setActiveSection(l.key)}
                  >
                    <strong>{l.label}</strong>
                    <span>{l.desc}</span>
                  </button>
                ))}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>المكتبات المحفوظة على هذا الجهاز</h2>
                  <p>إزالة من الجهاز لا تحذف حساب الخادم.</p>
                </div>
                <span className="count-badge">{organizations.length}</span>
              </div>
              {organizations.length === 0 ? (
                <div className="empty-state">لا توجد مكتبات محفوظة محليًا.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>اسم المكتبة</th>
                        <th>المعرّف</th>
                        <th>الهاتف</th>
                        <th>الحالة</th>
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
                            <span className={`tag ${org.localOnly ? 'local' : 'synced'}`}>
                              {org.localOnly ? 'محلي فقط' : 'على الخادم'}
                            </span>
                          </td>
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

            {sessionUser?.role === 'OWNER' && sessionOrg && (
              <section className="panel danger-zone">
                <div className="panel-heading">
                  <div>
                    <h2>منطقة خطرة</h2>
                    <p>حذف المكتبة من الخادم نهائي — لا يمكن التراجع. حسابات المستخدمين والفواتير تُحذف معها.</p>
                  </div>
                </div>
                <div className="inline-form" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
                  <label>
                    اكتب المعرّف للتأكيد (<span dir="ltr">{sessionOrg.slug}</span>)
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
                    حذف المكتبة نهائيًا من الخادم
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {activeSection === 'purchases' && hasPermission(sessionUser, 'purchases') ? (
          <Purchases />
        ) : activeSection === 'inventory' && hasPermission(sessionUser, 'inventory') ? (
          <Inventory />
        ) : activeSection === 'sales' && hasPermission(sessionUser, 'sales') ? (
          <Sales />
        ) : activeSection === 'printing' && hasPermission(sessionUser, 'printing') ? (
          <Printing />
        ) : activeSection === 'accounting' && hasPermission(sessionUser, 'accounting') ? (
          <Accounting />
        ) : activeSection === 'reports' && hasPermission(sessionUser, 'reports') ? (
          <Reports />
        ) : activeSection === 'admin' && isAdminUser(sessionUser) ? (
          <AdminUsers />
        ) : activeSection === 'settings' && isLoggedIn ? (
          <Settings />
        ) : null}
      </main>
    </div>
  );
}
