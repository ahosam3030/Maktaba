import { useEffect, useState } from 'react';
import { db, type LocalOrganization } from '../data/db';
import {
  apiHealth, registerOrganization, login, saveSession, clearSession,
  getToken, getStoredUser, getStoredOrganization, hasPermission, isAdminUser,
} from '../data/api';
import { Purchases } from './Purchases';
import { Inventory } from './Inventory';
import { Sales } from './Sales';
import { Printing } from './Printing';
import { Accounting } from './Accounting';
import { AdminUsers } from './AdminUsers';
import { Settings } from './Settings';

type ConnectionState = 'checking' | 'online' | 'offline';
type AuthMode = 'login' | 'register';

export function App() {
  const [connection, setConnection] = useState<ConnectionState>(navigator.onLine ? 'checking' : 'offline');
  const [apiStatus, setApiStatus] = useState('جارٍ الفحص');
  const [organizations, setOrganizations] = useState<LocalOrganization[]>([]);
  const [name, setName] = useState('مركز المهندس للخدمات العلمية والطباعة');
  const [slug, setSlug] = useState('al-mohandes');
  const [phone, setPhone] = useState('01127897245');
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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'purchases' | 'inventory' | 'sales' | 'printing' | 'accounting' | 'admin' | 'settings'>('dashboard');

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
      setMessage('أكمل البيانات المطلوبة، واجعل كلمة المرور 10 أحرف على الأقل.');
      return;
    }
    if (!navigator.onLine) {
      setMessage('إنشاء الحساب الأول يحتاج اتصالًا بالإنترنت.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await registerOrganization({
        organizationName: name.trim(), slug: slug.trim().toLowerCase(), phone: phone.trim() || undefined,
        fullName: ownerName.trim(), email: email.trim(), password,
      });
      saveSession(result);
      setSessionUser(result.user);
      setSessionOrg(result.organization);
      const localRecord: LocalOrganization = {
        id: result.organization.id, name: result.organization.name, slug: result.organization.slug,
        phone: phone.trim() || undefined, localOnly: false, updatedAt: new Date().toISOString(),
      };
      await db.organizations.put(localRecord);
      setMessage(`تم إنشاء الحساب بنجاح. مرحبًا ${result.user.fullName}.`);
      setPassword('');
      await refreshLocal();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء الحساب.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword) {
      setMessage('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await login(loginEmail.trim(), loginPassword);
      saveSession(result);
      setSessionUser(result.user);
      setSessionOrg(result.organization);
      const localRecord: LocalOrganization = {
        id: result.organization.id, name: result.organization.name, slug: result.organization.slug,
        localOnly: false, updatedAt: new Date().toISOString(),
      };
      await db.organizations.put(localRecord);
      setMessage(`مرحبًا ${result.user.fullName}`);
      setLoginPassword('');
      await refreshLocal();
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

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="brand-mark">م</div>
        <div className="brand-copy"><strong>إدارة المكتبات</strong><span>نظام تجاري</span></div>
        <nav>
          <a className={activeSection === 'dashboard' ? 'active' : ''} href="#dashboard" onClick={() => setActiveSection('dashboard')}>الرئيسية</a>
          {hasPermission(sessionUser, 'purchases') && (
            <a className={activeSection === 'purchases' ? 'active' : ''} href="#purchases" onClick={() => setActiveSection('purchases')}>المشتريات</a>
          )}
          {hasPermission(sessionUser, 'sales') && (
            <a className={activeSection === 'sales' ? 'active' : ''} href="#sales" onClick={() => setActiveSection('sales')}>المبيعات</a>
          )}
          {hasPermission(sessionUser, 'inventory') && (
            <a className={activeSection === 'inventory' ? 'active' : ''} href="#inventory" onClick={() => setActiveSection('inventory')}>المخزون</a>
          )}
          {hasPermission(sessionUser, 'accounting') && (
            <a className={activeSection === 'accounting' ? 'active' : ''} href="#accounting" onClick={() => setActiveSection('accounting')}>الخزينة</a>
          )}
          {hasPermission(sessionUser, 'printing') && (
            <a className={activeSection === 'printing' ? 'active' : ''} href="#printing" onClick={() => setActiveSection('printing')}>الخدمات والإيصالات</a>
          )}
          {isAdminUser(sessionUser) && (
            <a className={activeSection === 'admin' ? 'active' : ''} href="#admin" onClick={() => setActiveSection('admin')}>المستخدمون</a>
          )}
          {isLoggedIn && (
            <a className={activeSection === 'settings' ? 'active' : ''} href="#settings" onClick={() => setActiveSection('settings')}>إعدادات الفاتورة</a>
          )}
        </nav>
        <div className="sidebar-footer">
          {isLoggedIn && sessionUser ? (
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <div>{sessionUser.fullName}</div>
              <div style={{ opacity: 0.7 }}>{sessionOrg?.name}</div>
              <div style={{ opacity: 0.7 }}>
                {sessionUser.role === 'OWNER' ? 'مالك' : sessionUser.role === 'ADMIN' ? 'أدمن' : 'مستخدم'}
              </div>
              <button type="button" className="secondary-btn small" style={{ marginTop: 8, width: '100%' }} onClick={handleLogout}>تسجيل الخروج</button>
            </div>
          ) : (
            <span>الإصدار التجريبي 0.3.0</span>
          )}
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div><span className="eyebrow">مساحة العمل</span><h1>لوحة التحكم</h1></div>
          <div className="status-pills">
            <span className={`pill ${connection === 'online' ? 'good' : 'warn'}`}>
              <i /> {connection === 'online' ? 'متصل بالإنترنت' : connection === 'checking' ? 'جارٍ الفحص' : 'وضع محلي'}
            </span>
            <span className="pill neutral">الخادم: {apiStatus}</span>
            <span className={`pill ${isLoggedIn ? 'good' : 'warn'}`}>{isLoggedIn ? 'مسجّل الدخول' : 'غير مسجّل'}</span>
          </div>
        </header>

        {activeSection === 'purchases' && hasPermission(sessionUser, 'purchases') ? <Purchases />
          : activeSection === 'inventory' && hasPermission(sessionUser, 'inventory') ? <Inventory />
          : activeSection === 'sales' && hasPermission(sessionUser, 'sales') ? <Sales />
          : activeSection === 'printing' && hasPermission(sessionUser, 'printing') ? <Printing />
          : activeSection === 'accounting' && hasPermission(sessionUser, 'accounting') ? <Accounting />
          : activeSection === 'admin' && isAdminUser(sessionUser) ? <AdminUsers />
          : activeSection === 'settings' && isLoggedIn ? <Settings />
          : <>
        <section className="welcome-card">
          <div>
            <span className="welcome-label">مرحبًا بك</span>
            <h2>إدارة مكتبتك من مكان واحد</h2>
            <p>سجّل الدخول لاستخدام المشتريات والمبيعات والمخزون والخزينة المرتبطة بالخادم.</p>
          </div>
          <div className="welcome-icon">▦</div>
        </section>

        <section className="stats-grid">
          <article className="stat-card"><span>المكتبات على هذا الجهاز</span><strong>{organizations.length}</strong><small>محليًا</small></article>
          <article className="stat-card"><span>حالة الجلسة</span><strong>{isLoggedIn ? 'نشطة' : '—'}</strong><small>{sessionUser?.email || 'سجّل الدخول'}</small></article>
          <article className="stat-card"><span>حالة قاعدة البيانات</span><strong className="stat-ok">جاهزة</strong><small>PostgreSQL + IndexedDB</small></article>
        </section>

        <section className="panel" id="auth">
          <div className="panel-heading">
            <div>
              <h2>{authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب مكتبة جديدة'}</h2>
              <p>{authMode === 'login' ? 'ادخل ببيانات حسابك الحالي.' : 'أنشئ مكتبة وحساب مالك في خطوة واحدة.'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={authMode === 'login' ? 'primary-btn small' : 'secondary-btn small'} onClick={() => { setAuthMode('login'); setMessage(''); }}>دخول</button>
              <button type="button" className={authMode === 'register' ? 'primary-btn small' : 'secondary-btn small'} onClick={() => { setAuthMode('register'); setMessage(''); }}>تسجيل</button>
            </div>
          </div>

          {authMode === 'login' ? (
            <>
              <div className="form-grid">
                <label>البريد الإلكتروني<input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} dir="ltr" placeholder="name@example.com" /></label>
                <label>كلمة المرور<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} dir="ltr" placeholder="كلمة المرور" /></label>
              </div>
              <div className="form-actions">
                <button onClick={() => void handleLogin()} disabled={busy}>{busy ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button>
                <span className="feedback" role="status">{message}</span>
              </div>
            </>
          ) : (
            <>
              <div className="form-grid">
                <label>اسم المكتبة<input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المكتبة" /></label>
                <label>المعرّف المختصر<input value={slug} onChange={(e) => setSlug(e.target.value)} dir="ltr" placeholder="library-name" /><small>أحرف إنجليزية وأرقام وشرطة فقط.</small></label>
                <label>رقم الهاتف<input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="رقم الهاتف" /></label>
                <label>اسم صاحب المكتبة<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="الاسم بالكامل" /></label>
                <label>البريد الإلكتروني<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="name@example.com" /></label>
                <label>كلمة المرور<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" minLength={10} placeholder="10 أحرف على الأقل" /></label>
              </div>
              <div className="form-actions">
                <button onClick={() => void handleRegister()} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'إنشاء حساب المكتبة'}</button>
                <span className="feedback" role="status">{message}</span>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><h2>المكتبات المحفوظة على هذا الجهاز</h2><p>مرجع محلي سريع بعد تسجيل الدخول.</p></div><span className="count-badge">{organizations.length}</span></div>
          {organizations.length === 0 ? <div className="empty-state"><div>▤</div><strong>لا توجد مكتبات محفوظة بعد</strong><span>سجّل الدخول أو أنشئ حسابًا للبدء.</span></div> :
            <div className="table-wrap"><table><thead><tr><th>اسم المكتبة</th><th>المعرّف</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>{organizations.map((org) => <tr key={org.id}><td>{org.name}</td><td dir="ltr">{org.slug}</td><td dir="ltr">{org.phone || '—'}</td><td><span className={`tag ${org.localOnly ? 'local' : 'synced'}`}>{org.localOnly ? 'محلي فقط' : 'محفوظ على الخادم'}</span></td></tr>)}</tbody></table></div>}
        </section>
        <footer>نظام إدارة المكتبات والطباعة · نسخة 0.2.0</footer>
        </>}
      </main>
    </div>
  );
}
