/**
 * يمنع اختصارات أدوات المطوّر ويستقبل رشقات ماسح الباركود
 * قبل أن تصل للمتصفح.
 */

const DEVTOOLS_KEYS = new Set(['I', 'J', 'C', 'K', 'i', 'j', 'c', 'k']);

export function isDevToolsShortcut(e: KeyboardEvent): boolean {
  if (e.key === 'F12') return true;
  if (e.key === 'F12' || e.code === 'F12') return true;
  // Ctrl+Shift+I/J/C/K  أو  Cmd+Option+I على ماك
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && DEVTOOLS_KEYS.has(e.key)) return true;
  if ((e.ctrlKey || e.metaKey) && e.altKey && DEVTOOLS_KEYS.has(e.key)) return true;
  // Ctrl+Shift+i with e.code
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyK'].includes(e.code)) return true;
  return false;
}

export type ScanHandler = (code: string) => void;

/**
 * يثبّت مستمع capture على window:
 * - يمنع F12 واختصارات DevTools دائمًا
 * - يجمع الرشقات السريعة من الماسح ويستدعي onScan
 */
export function attachBarcodeGuard(onScan: ScanHandler): () => void {
  let buffer = '';
  let lastTs = 0;
  let burst = false;

  const onKeyDown = (e: KeyboardEvent) => {
    // 1) قطع اختصارات أدوات المطوّر دائمًا داخل شاشات العمل
    if (isDevToolsShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    const now = Date.now();
    const gap = now - lastTs;
    lastTs = now;

    if (gap < 55) burst = true;
    if (gap > 100) {
      burst = false;
      // لا نفرّغ buffer هنا إلا إذا انتهت الرشقة منذ زمن
      if (gap > 200) buffer = '';
    }

    // أثناء الرشقة: امنع أي معدل/تحكم من الوصول للمتصفح
    if (burst && (e.ctrlKey || e.metaKey || e.altKey)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    if (e.key === 'Enter') {
      const code = buffer.trim();
      buffer = '';
      const wasBurst = burst || gap < 120;
      burst = false;
      if (code.length >= 3 && wasBurst) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onScan(code);
      }
      return;
    }

    // تجاهل مفاتيح التحكم المنفردة
    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (gap > 100) buffer = '';
    buffer += e.key;

    // رشقة سريعة خارج حقول الإدخال أو داخل الباركود: لا تترك المفاتيح تتسرب
    const target = e.target as HTMLElement | null;
    const tag = (target?.tagName || '').toLowerCase();
    const field = target?.getAttribute?.('data-field') || '';
    const isBarcodeField = field === 'barcode';
    const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (burst || gap < 50) {
      if (!isEditable || isBarcodeField) {
        // في حقل الباركود نترك onChange يعمل عبر التدفق الطبيعي إن رُغبت
        // لكن نمنع الافتراضي فقط خارج الحقول
        if (!isEditable) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };

  // capture=true + أول المستمعين عمليًا
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
