import { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onScan: (code: string) => void;
};

/**
 * وضع مسح ملء الشاشة: يلتقط كل المفاتيح ويمنع وصولها للمتصفح أثناء الفتح.
 */
export function ScanModeOverlay({ open, title, onClose, onScan }: Props) {
  const [buffer, setBuffer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef('');

  useEffect(() => {
    if (!open) return;
    bufferRef.current = '';
    setBuffer('');
    const focus = () => inputRef.current?.focus();
    focus();
    const id = window.setInterval(focus, 400);

    const blockDevTools = (e: KeyboardEvent) => {
      const k = e.key;
      const code = e.code;
      if (
        k === 'F12' ||
        code === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C', 'K', 'i', 'j', 'c', 'k'].includes(k)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyK'].includes(code))
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      blockDevTools(e);
      // لا تغلق بـ Escape فقط من الزر — Escape يغلق الوضع
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        setBuffer('');
        if (code.length >= 3) {
          onScan(code);
        }
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        bufferRef.current = bufferRef.current.slice(0, -1);
        setBuffer(bufferRef.current);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        bufferRef.current += e.key;
        setBuffer(bufferRef.current);
      } else if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', blockDevTools, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', blockDevTools, true);
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.92)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        color: '#fff',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>وضع ماسح الباركود</div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>{title || 'وجّه الماسح الآن'}</h2>
        <p style={{ opacity: 0.85, lineHeight: 1.6, marginBottom: 20 }}>
          امسح الباركود. لا تضغط F12. للإلغاء: Escape أو زر إغلاق.
        </p>
        <div
          dir="ltr"
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 28,
            letterSpacing: 2,
            minHeight: 48,
            padding: '12px 16px',
            borderRadius: 12,
            background: '#0f172a',
            border: '1px solid #334155',
            marginBottom: 20,
            wordBreak: 'break-all',
          }}
        >
          {buffer || '…'}
        </div>
        <input
          ref={inputRef}
          value={buffer}
          readOnly
          aria-label="ماسح"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        />
        <button
          type="button"
          className="secondary-btn"
          onClick={onClose}
          style={{ padding: '10px 20px' }}
        >
          إغلاق وضع المسح
        </button>
      </div>
    </div>
  );
}
