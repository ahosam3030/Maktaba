import { useCallback, useEffect, useState } from 'react';
import { apiRequest, ALL_PERMISSIONS, getStoredUser, clearSession, type Permission } from '../data/api';

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
  printing: 'الخدمات',
  reports: 'التقارير',
  users: 'إدارة المستخدمين',
};

export function AdminUsers({ embedded = false }: { embedded?: boolean }) {
  const me = getStoredUser();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN' | 'OWNER'>('USER');
  const [perms, setPerms] = useState<string[]>(['sales', 'printing']);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await apiRequest<OrgUser[]>('/users');
      setUsers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المستخدمين.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function togglePerm(p: string) {
    setPerms((old) => (old.includes(p) ? old.filter((x) => x !== p) : [...old, p]));
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
          permissions: role === 'USER' ? perms : [...ALL_PERMISSIONS],
        }),
      });
      setNotice(
        role === 'OWNER'
          ? 'تم إنشاء مالك جديد. يمكنك الآن حذف الحساب الافتراضي إن وُجد.'
          : 'تم إضافة المستخدم.',
      );
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('USER');
      setPerms(['sales', 'printing']);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الإضافة.');
    }
  }

  async function saveUser(
    u: OrgUser,
    patch: Partial<{ role: string; permissions: string[]; active: boolean; fullName: string; password: string }>,
  ) {
    setNotice('');
    try {
      await apiRequest(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setNotice('تم حفظ التعديلات.');
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحفظ.');
    }
  }

  async function deleteUser(u: OrgUser) {
    const isSelf = me?.id === u.id;
    if (
      !confirm(
        isSelf
          ? `حذف حسابك الحالي «${u.email}»؟ ستحتاج للدخول بحساب مالك آخر.`
          : `حذف المستخدم «${u.fullName}» (${u.email}) نهائيًا؟`,
      )
    ) {
      return;
    }
    setNotice('');
    try {
      await apiRequest(`/users/${u.id}`, { method: 'DELETE' });
      setNotice(`تم حذف ${u.email}.`);
      if (isSelf) {
        clearSession();
        window.location.reload();
        return;
      }
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحذف.');
    }
  }

  if (me?.role !== 'OWNER') {
    return (
      <div className="purchase-notice" role="alert">
        إنشاء وتعديل حسابات المستخدمين متاح لمالك المكتبة فقط.
      </div>
    );
  }

  const ownerCount = users.filter((u) => u.role === 'OWNER').length;

  return (
    <div className={embedded ? '' : 'purchases-page'}>
      {!embedded && (
        <div className="purchase-title">
          <div>
            <span className="eyebrow">لوحة الأدمن</span>
            <h1>إدارة المستخدمين</h1>
          </div>
        </div>
      )}

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

      <div className="settings-hint">
        <strong>استبدال الحساب الافتراضي:</strong> أنشئ مستخدمًا بدور <em>مالك</em> ببريدك وكلمة مرورك، ثم احذف
        حساب <code dir="ltr">admin@maktaba.local</code> من الجدول. يجب أن يبقى مالك واحد على الأقل.
        {ownerCount > 0 && (
          <span>
            {' '}
            (عدد الملاك حاليًا: {ownerCount})
          </span>
        )}
      </div>

      <section className="purchase-panel" style={{ marginTop: 12 }}>
        <div className="panel-heading">
          <div>
            <h2>مستخدم جديد</h2>
            <p>المالك / أدمن / مستخدم عادي مع صلاحيات محددة.</p>
          </div>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          <label>
            الاسم
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم بالكامل" />
          </label>
          <label>
            البريد
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </label>
          <label>
            كلمة المرور
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" minLength={10} />
          </label>
          <label>
            الدور
            <select value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN' | 'OWNER')}>
              <option value="USER">مستخدم عادي</option>
              <option value="ADMIN">أدمن</option>
              <option value="OWNER">مالك</option>
            </select>
          </label>
        </div>
        {role === 'USER' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {ALL_PERMISSIONS.filter((p) => p !== 'users').map((p) => (
              <label key={p} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} />
                {PERM_LABELS[p as Permission] || p}
              </label>
            ))}
          </div>
        )}
        <div className="form-actions">
          <button className="primary-btn" type="button" onClick={() => void createUser()}>
            إضافة المستخدم
          </button>
          <button className="secondary-btn" type="button" onClick={() => void refresh()}>
            تحديث القائمة
          </button>
        </div>
      </section>

      <section className="purchase-panel">
        <div className="panel-heading">
          <div>
            <h2>المستخدمون</h2>
            <p>حذف المالك الافتراضي متاح بعد وجود مالك آخر.</p>
          </div>
          <span className="count-badge">{users.length}</span>
        </div>
        {loading ? (
          <div className="empty-state">جارٍ التحميل...</div>
        ) : (
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
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actorId={me?.id || ''}
                    ownerCount={ownerCount}
                    onSave={saveUser}
                    onDelete={deleteUser}
                  />
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
  user,
  actorId,
  ownerCount,
  onSave,
  onDelete,
}: {
  user: OrgUser;
  actorId: string;
  ownerCount: number;
  onSave: (
    u: OrgUser,
    patch: Partial<{ role: string; permissions: string[]; active: boolean }>,
  ) => Promise<void>;
  onDelete: (u: OrgUser) => Promise<void>;
}) {
  const isOwner = user.role === 'OWNER';
  const [localPerms, setLocalPerms] = useState<string[]>(user.permissions);
  useEffect(() => {
    setLocalPerms(user.permissions);
  }, [user.permissions]);

  function toggle(p: string) {
    setLocalPerms((old) => (old.includes(p) ? old.filter((x) => x !== p) : [...old, p]));
  }

  const canDelete = !(isOwner && ownerCount <= 1);

  return (
    <tr>
      <td>
        {user.fullName}
        {user.id === actorId ? (
          <span className="tag synced" style={{ marginInlineStart: 6 }}>
            أنت
          </span>
        ) : null}
        {user.email === 'admin@maktaba.local' ? (
          <span className="tag local" style={{ marginInlineStart: 6 }}>
            افتراضي
          </span>
        ) : null}
      </td>
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
      <td>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!isOwner && user.role === 'USER' && (
            <button
              className="secondary-btn small"
              type="button"
              onClick={() => void onSave(user, { permissions: localPerms })}
            >
              حفظ الصلاحيات
            </button>
          )}
          {!isOwner && user.role === 'USER' && (
            <button
              className="secondary-btn small"
              type="button"
              onClick={() => void onSave(user, { role: 'ADMIN', permissions: [...ALL_PERMISSIONS] })}
            >
              ترقية لأدمن
            </button>
          )}
          {!isOwner && user.role === 'ADMIN' && (
            <button
              className="secondary-btn small"
              type="button"
              onClick={() => void onSave(user, { role: 'USER', permissions: localPerms.length ? localPerms : ['sales'] })}
            >
              تحويل لمستخدم
            </button>
          )}
          {!isOwner && (
            <button
              className="secondary-btn small"
              type="button"
              onClick={() => void onSave(user, { active: !user.active })}
            >
              {user.active ? 'تعطيل' : 'تفعيل'}
            </button>
          )}
          {canDelete && (
            <button className="danger-outline-btn" type="button" onClick={() => void onDelete(user)}>
              حذف
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
