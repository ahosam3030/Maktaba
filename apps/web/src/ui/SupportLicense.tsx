import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../data/api';

function deviceId(): string {
  const key = 'maktaba_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function SupportLicense() {
  const [status, setStatus] = useState<{
    activated: boolean;
    maxDevices: number;
    usedDevices: number;
    devices: Array<{ deviceId: string; deviceName: string | null; activatedAt: string }>;
  } | null>(null);
  const [serial, setSerial] = useState('');
  const [msg, setMsg] = useState('');
  const [supportCfg, setSupportCfg] = useState<{ whatsappUrl: string; whatsapp: string } | null>(null);
  const [tickets, setTickets] = useState<Array<{ id: string; subject: string; body: string; status: string; createdAt: string }>>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, cfg, tix] = await Promise.all([
        apiRequest<NonNullable<typeof status>>('/license/status'),
        apiRequest<{ whatsappUrl: string; whatsapp: string }>('/support/config'),
        apiRequest<typeof tickets>('/support/tickets'),
      ]);
      setStatus(st);
      setSupportCfg(cfg);
      setTickets(Array.isArray(tix) ? tix : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'تعذر التحميل');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate() {
    setBusy(true);
    setMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/license/activate', {
        method: 'POST',
        body: JSON.stringify({
          serialKey: serial.trim(),
          deviceId: deviceId(),
          deviceName: navigator.userAgent.slice(0, 80),
        }),
      });
      setMsg(res.message || 'تم التفعيل');
      setSerial('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'فشل التفعيل');
    } finally {
      setBusy(false);
    }
  }

  async function sendTicket() {
    setBusy(true);
    setMsg('');
    try {
      await apiRequest('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      setSubject('');
      setBody('');
      setMsg('تم إرسال البلاغ');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'تعذر الإرسال');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-stack">
      <section className="panel">
        <h3>ترخيص الأجهزة</h3>
        <p className="muted">رقم تسلسلي يحدد أقصى عدد أجهزة لنفس المكتبة.</p>
        {status && (
          <p>
            الحالة: {status.activated ? 'مفعّل' : 'غير مفعّل'} · الأجهزة {status.usedDevices}/{status.maxDevices || '—'}
          </p>
        )}
        <div className="form-grid" style={{ maxWidth: 480 }}>
          <label>
            مفتاح الترخيص
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="MAK-XXXX-XXXX-XXXX-1ABCD" dir="ltr" />
          </label>
        </div>
        <button type="button" className="primary-btn" disabled={busy || !serial.trim()} onClick={() => void activate()}>
          تفعيل هذا الجهاز
        </button>
        {status?.devices?.length ? (
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>الجهاز</th>
                <th>التفعيل</th>
              </tr>
            </thead>
            <tbody>
              {status.devices.map((d) => (
                <tr key={d.deviceId}>
                  <td dir="ltr">{d.deviceName || d.deviceId}</td>
                  <td>{new Date(d.activatedAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="panel">
        <h3>الدعم الفني</h3>
        {supportCfg?.whatsappUrl ? (
          <p>
            <a href={supportCfg.whatsappUrl} target="_blank" rel="noreferrer">
              تواصل واتساب
            </a>
          </p>
        ) : null}
        <div className="form-grid">
          <label>
            عنوان البلاغ
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            الوصف
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </label>
        </div>
        <button type="button" className="primary-btn" disabled={busy || !subject.trim() || !body.trim()} onClick={() => void sendTicket()}>
          إرسال بلاغ
        </button>
        {tickets.length > 0 && (
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>العنوان</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.subject}</td>
                  <td>{t.status}</td>
                  <td>{new Date(t.createdAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {msg ? <p className="purchase-notice">{msg}</p> : null}
    </div>
  );
}
