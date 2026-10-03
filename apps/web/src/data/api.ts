const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TOKEN_KEY = 'maktaba_access_token';
const USER_KEY = 'maktaba_user';
const ORG_KEY = 'maktaba_organization';

export const ALL_PERMISSIONS = ['purchases', 'sales', 'inventory', 'accounting', 'printing', 'reports', 'users'] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ORG_KEY);
}

export function saveSession(result: AuthResult) {
  sessionStorage.setItem(TOKEN_KEY, result.accessToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
  sessionStorage.setItem(ORG_KEY, JSON.stringify(result.organization));
}

export function getStoredUser(): AuthResult['user'] | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredOrganization(): AuthResult['organization'] | null {
  try {
    const raw = sessionStorage.getItem(ORG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAdminUser(user: AuthResult['user'] | null | undefined): boolean {
  return !!user && (user.role === 'OWNER' || user.role === 'ADMIN');
}

export function hasPermission(user: AuthResult['user'] | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export async function apiHealth(): Promise<{ status: string; service: string; version: string }> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error('تعذر الاتصال بالخادم');
  return response.json();
}

export type RegistrationInput = {
  organizationName: string; slug: string; phone?: string; fullName: string; email: string; password: string;
};

export type AuthResult = {
  accessToken: string;
  tokenType: 'Bearer';
  user: { id: string; fullName: string; email: string; role: string; permissions: string[] };
  organization: { id: string; name: string; slug: string; phone?: string | null };
};

export async function registerOrganization(input: RegistrationInput): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'فشل إنشاء الحساب. راجع البيانات وحاول مرة أخرى.');
  return result as AuthResult;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'فشل تسجيل الدخول.');
  return result as AuthResult;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(result.message || 'تعذر تنفيذ الطلب.');
  }
  return result as T;
}
