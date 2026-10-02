import { useCallback, useEffect, useState } from 'react';
import { apiRequest, ALL_PERMISSIONS, getStoredUser, isAdminUser, type Permission } from '../data/api';

type OrgUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
  active: boolean;
  createdAt?: string;
};

const PERM_LABELS: Record<string, string> = {
  purchases: 'المشتريات',
  sales: 'المبيعات',
  inventory: 'المخزون',
  accounting: 'الخزينة',
  printing: 'الطباعة',
  users: 'إدارة المستخدمين',
};

export function AdminUsers() {
  const me = getStoredUser();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [perms, setPerms] = useState<string[]>(['sales', 'printing']);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await apiRequest<OrgUser[]>('/users');
      setUsers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المستخدمين.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function togglePerm(p: string) {
    setPerms((old) => old.includes(p) ? old.filter((x) => x !== p) : [...old, p]);
  }

  async function createUser() {
    setNotice('');
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          role,
          permissions: role === 'ADMIN' ? [...ALL_PERMISSIONS] : perms,
        }),
      });
      setNotice('تم إنشاء المستخدم.');
      setFullName(''); setEmail(''); setPassword('');
      setRole('USER'); setPerms(['sales', 'printing']);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر إنشاء المستخدم.');
    }
  }

  async function saveUser(u: OrgUser, patch: Partial<{ role: string; permissions: string[]; active: boolean }>) {
    setNotice('');
    try {
      await apiRequest(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setNotice('تم حفظ التعديلات.');
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحفظ.');
    }
  }

  if (!isAdminUser(me)) {
    return <div className="purchases-page"><div className="purchase-notice" role="alert">هذه الصفحة للأدمن فقط.</div></div>;
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">لوحة الأدمن</span>
          <h1>إدارة المستخدمين والصلاحيات</h1>
          <p>أضف موظفين وحدّد الشاشات المسموح لهم بها. المالك والأدمن يريان كل الأقسام.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void refresh()}>تحديث</button>
      </div>
      {notice && <div className="purchase-notice" role="status">{notice}</div>}
      {error && <div className="purchase-notice" role="alert">{error}</div>}

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>مستخدم جديد</h2></div></div>
        <div className="purchase-form-grid">
          <label>الاسم<input value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label>البريد<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>كلمة المرور<input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="10 أحرف على الأقل" /></label>
          <label>الدور<select value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}>
            <option value="USER">مستخدم عادي</option>
            {me?.role === 'OWNER' && <option value="ADMIN">أدمن</option>}
          </select></label>
        </div>
        {role === 'USER' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' }}>
            {ALL_PERMISSIONS.filter((p) => p !== 'users').map((p) => (
              <label key={p} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} />
                {PERM_LABELS[p] || p}
              </label>
            ))}
          </div>
        )}
        <button className="primary-btn" type="button" onClick={() => void createUser()}>إضافة المستخدم</button>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading"><div><h2>المستخدمون</h2></div><span className="count-badge">{users.length}</span></div>
        {loading ? <div className="empty-state">جارٍ التحميل...</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الدور</th>
                  <th>الصلاحيات</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} actorRole={me?.role || 'USER'} onSave={saveUser} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user, actorRole, onSave,
}: {
  user: OrgUser;
  actorRole: string;
  onSave: (u: OrgUser, patch: Partial<{ role: string; permissions: string[]; active: boolean }>) => Promise<void>;
}) {
  const isOwner = user.role === 'OWNER';
  const [localPerms, setLocalPerms] = useState<string[]>(user.permissions);
  useEffect(() => { setLocalPerms(user.permissions); }, [user.permissions]);

  function toggle(p: string) {
    setLocalPerms((old) => old.includes(p) ? old.filter((x) => x !== p) : [...old, p]);
  }

  return (
    <tr>
      <td>{user.fullName}</td>
      <td dir="ltr">{user.email}</td>
      <td>{user.role === 'OWNER' ? 'مالك' : user.role === 'ADMIN' ? 'أدمن' : 'مستخدم'}</td>
      <td>
        {isOwner || user.role === 'ADMIN' ? (
          <span>كل الصلاحيات</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_PERMISSIONS.filter((p) => p !== 'users').map((p) => (
              <label key={p} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
                <input type="checkbox" checked={localPerms.includes(p)} onChange={() => toggle(p)} />
                {PERM_LABELS[p]}
              </label>
            ))}
          </div>
        )}
      </td>
      <td>{user.active ? 'نشط' : 'معطّل'}</td>
      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!isOwner && user.role === 'USER' && (
          <button className="secondary-btn small" type="button" onClick={() => void onSave(user, { permissions: localPerms })}>
            حفظ الصلاحيات
          </button>
        )}
        {!isOwner && actorRole === 'OWNER' && user.role === 'USER' && (
          <button className="secondary-btn small" type="button" onClick={() => void onSave(user, { role: 'ADMIN', permissions: [...ALL_PERMISSIONS] })}>
            ترقية لأدمن
          </button>
        )}
        {!isOwner && actorRole === 'OWNER' && user.role === 'ADMIN' && (
          <button className="secondary-btn small" type="button" onClick={() => void onSave(user, { role: 'USER', permissions: localPerms.length ? localPerms : ['sales'] })}>
            تحويل لمستخدم
          </button>
        )}
        {!isOwner && (
          <button className="secondary-btn small" type="button" onClick={() => void onSave(user, { active: !user.active })}>
            {user.active ? 'تعطيل' : 'تفعيل'}
          </button>
        )}
      </td>
    </tr>
  );
}
