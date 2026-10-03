import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

/** تكلفة bcrypt — أعلى = أبطأ وأأمن (12–14 مناسب للسيرفرات العادية) */
const BCRYPT_ROUNDS = 14;

/**
 * كلمات المرور: تجزئة bcrypt أحادية الاتجاه (لا تُستخدم AES هنا).
 * AES قابل للعكس؛ لو المفتاح اتسرب تتكشف كل كلمات المرور.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  if (!plain || !passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getAesKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw.trim()) return null;
  // 32 bytes key: من نص (sha256) أو hex بطول 64
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    return Buffer.from(raw.trim(), 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * تشفير AES-256-GCM للبيانات الحساسة غير كلمات المرور (مثل ملاحظات).
 * الصيغة المخزّنة: enc:v1:<iv_b64>:<tag_b64>:<cipher_b64>
 */
export function encryptSensitive(plain: string): string {
  if (plain == null || plain === '') return plain;
  const key = getAesKey();
  if (!key) {
    // بدون مفتاح: لا نكسر التشغيل؛ نخزّن كما هو مع تحذير في اللوج مرة واحدة
    return plain;
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
}

export function decryptSensitive(stored: string | null | undefined): string {
  if (stored == null || stored === '') return '';
  if (!stored.startsWith('enc:v1:')) return stored;
  const key = getAesKey();
  if (!key) return stored;
  const parts = stored.split(':');
  // enc v1 iv tag data
  if (parts.length !== 5) return stored;
  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const data = Buffer.from(parts[4], 'base64url');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptionConfigured(): boolean {
  return Boolean(getAesKey());
}
