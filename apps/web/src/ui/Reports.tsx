import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../data/api';
import { ProductPriceReport } from './ProductPriceReport';

const money = (n: number) =>
  `${(Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
const qty = (n: number) => (Number(n) || 0).toLocaleString('ar-EG', { maximumFractionDigits: 3 });
const pct = (n: number) => `${(Number(n) || 0).toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;

type Summary = {
  period: { from: string | null; to: string | null };
  inventory: {
    skusTotal: number;
    skusInStock: number;
    unitsInStock: number;
    valueAtCost: number;
    valueAtSale: number;
    potentialProfit: number;
    items: Array<{
      id: string;
      name: string;
      barcode: string | null;
      stock: number;
      currentCost: number;
      salePrice: number;
      purchased: number;
      sold: number;
      returned: number;
      valueAtCost: number;
      valueAtSale: number;
    }>;
  };
  sales: {
    count: number;
    revenue: number;
    discount: number;
    net: number;
    paid: number;
    due: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
  };
  purchases: {
    invoicesCount: number;
    total: number;
    paidOnInvoices: number;
    supplierPayments: number;
    returns: number;
    supplierDebt: number;
    purchasesAllTime: number;
  };
  cash: { income: number; expense: number; net: number; balanceAllTime: number };
  capital: { inStock: number; liquid: number; supplierDebt: number; working: number; remaining: number };
};

type SeriesRow = { key: string; label: string; salesNet: number; cogs: number; profit: number; count: number };

function today() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
}

export function Reports() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('day');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockQuery, setStockQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [s, ser] = await Promise.all([
        apiRequest<Summary>(`/reports/summary?${q}`),
        apiRequest<{ series: SeriesRow[] }>(`/reports/profit-series?groupBy=${groupBy}&${q}`),
      ]);
      setSummary(s);
      setSeries(ser.series || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل التقارير.');
      setSummary(null);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => {
    void load();
  }, [load]);

  const stockRows = useMemo(() => {
    const items = summary?.inventory.items || [];
    const q = stockQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.barcode || '').toLowerCase().includes(q),
    );
  }, [summary, stockQuery]);

  function preset(kind: 'today' | 'month' | 'year') {
    setTo(today());
    if (kind === 'today') {
      setFrom(today());
      setGroupBy('day');
    } else if (kind === 'month') {
      setFrom(startOfMonth());
      setGroupBy('day');
    } else {
      setFrom(startOfYear());
      setGroupBy('month');
    }
  }

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">لوحة مالية</span>
          <h1>التقارير ورأس المال</h1>
          <p>
            أرصدة المخزون من فواتير الوارد والمبيعات، الأرباح حسب الفترة، ورأس المال (نقد + بضاعة − مديونية الموردين).
          </p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void load()}>
          تحديث
        </button>
      </div>

      {error && (
        <div className="purchase-notice" role="alert">
          {error}
        </div>
      )}

      <section className="purchase-panel">
        <div className="panel-heading">
          <div>
            <h2>الفترة</h2>
            <p>الأرباح والمشتريات والمبيعات تُحسب ضمن التواريخ المحددة. رأس المال والمخزون يعكسان الوضع الحالي.</p>
          </div>
        </div>
        <div className="inline-form" style={{ flexWrap: 'wrap', gap: 10 }}>
          <label>
            من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            تجميع الأرباح
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'month' | 'year')}>
              <option value="day">يومي</option>
              <option value="month">شهري</option>
              <option value="year">سنوي</option>
            </select>
          </label>
          <button className="secondary-btn small" type="button" onClick={() => preset('today')}>
            اليوم
          </button>
          <button className="secondary-btn small" type="button" onClick={() => preset('month')}>
            هذا الشهر
          </button>
          <button className="secondary-btn small" type="button" onClick={() => preset('year')}>
            هذه السنة
          </button>
        </div>
      </section>

      {loading && <div className="empty-state">جارٍ حساب التقارير...</div>}

      {summary && !loading && (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>رأس المال المتبقي (عامل)</span>
              <strong style={{ color: summary.capital.remaining >= 0 ? '#0a7a4b' : '#b42318' }}>
                {money(summary.capital.remaining)}
              </strong>
              <small>نقد + مخزون بالتكلفة − دين الموردين</small>
            </article>
            <article className="stat-card">
              <span>رأس المال في البضاعة</span>
              <strong>{money(summary.capital.inStock)}</strong>
              <small>قيمة الأرصدة بسعر التكلفة</small>
            </article>
            <article className="stat-card">
              <span>رصيد الخزينة</span>
              <strong>{money(summary.capital.liquid)}</strong>
              <small>إيرادات − مصروفات (كل الفترات)</small>
            </article>
            <article className="stat-card">
              <span>مديونية الموردين</span>
              <strong>{money(summary.capital.supplierDebt)}</strong>
              <small>متبقي على فواتير الوارد</small>
            </article>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <span>صافي المبيعات (الفترة)</span>
              <strong>{money(summary.sales.net)}</strong>
              <small>{summary.sales.count} فاتورة · محصّل {money(summary.sales.paid)}</small>
            </article>
            <article className="stat-card">
              <span>تكلفة البضاعة المباعة</span>
              <strong>{money(summary.sales.cogs)}</strong>
              <small>من تكلفة الأصناف عند البيع</small>
            </article>
            <article className="stat-card">
              <span>مجمل الربح (الفترة)</span>
              <strong style={{ color: summary.sales.grossProfit >= 0 ? '#0a7a4b' : '#b42318' }}>
                {money(summary.sales.grossProfit)}
              </strong>
              <small>هامش {pct(summary.sales.grossMarginPct)}</small>
            </article>
            <article className="stat-card">
              <span>مشتريات الفترة</span>
              <strong>{money(summary.purchases.total)}</strong>
              <small>{summary.purchases.invoicesCount} فاتورة وارد</small>
            </article>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <span>أصناف لها رصيد</span>
              <strong>
                {summary.inventory.skusInStock} / {summary.inventory.skusTotal}
              </strong>
              <small>{qty(summary.inventory.unitsInStock)} قطعة إجمالاً</small>
            </article>
            <article className="stat-card">
              <span>قيمة المخزون بسعر البيع</span>
              <strong>{money(summary.inventory.valueAtSale)}</strong>
              <small>ربح كامن {money(summary.inventory.potentialProfit)}</small>
            </article>
            <article className="stat-card">
              <span>خزينة الفترة</span>
              <strong>{money(summary.cash.net)}</strong>
              <small>
                وارد {money(summary.cash.income)} · منصرف {money(summary.cash.expense)}
              </small>
            </article>
            <article className="stat-card">
              <span>مبيعات آجلة (الفترة)</span>
              <strong>{money(summary.sales.due)}</strong>
              <small>صافي − محصّل</small>
            </article>
          </section>

          <section className="purchase-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  الأرباح{' '}
                  {groupBy === 'day' ? 'اليومية' : groupBy === 'month' ? 'الشهرية' : 'السنوية'}
                </h2>
                <p>من فواتير البيع ضمن الفترة (صافي المبيعات − تكلفة البضاعة).</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الفترة</th>
                    <th>عدد الفواتير</th>
                    <th>صافي المبيعات</th>
                    <th>التكلفة</th>
                    <th>الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.count}</td>
                      <td>{money(row.salesNet)}</td>
                      <td>{money(row.cogs)}</td>
                      <td style={{ color: row.profit >= 0 ? '#0a7a4b' : '#b42318', fontWeight: 700 }}>
                        {money(row.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {series.length === 0 && <div className="empty-state">لا مبيعات في هذه الفترة.</div>}
            </div>
          </section>

          <ProductPriceReport />

          <section className="purchase-panel">
            <div className="panel-heading">
              <div>
                <h2>أرصدة المخزون (من الوارد − المبيعات − المرتجعات ± التسويات)</h2>
                <p>كل صنف يظهر بعد أول فاتورة وارد. القيمة = الرصيد × تكلفة القطعة الحالية.</p>
              </div>
              <input
                style={{ maxWidth: 260 }}
                placeholder="بحث صنف / باركود"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>باركود</th>
                    <th>وارد</th>
                    <th>مباع</th>
                    <th>مرتجع</th>
                    <th>الرصيد</th>
                    <th>تكلفة القطعة</th>
                    <th>قيمة التكلفة</th>
                    <th>سعر البيع</th>
                    <th>قيمة البيع</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td dir="ltr">{i.barcode || '—'}</td>
                      <td>{qty(i.purchased)}</td>
                      <td>{qty(i.sold)}</td>
                      <td>{qty(i.returned)}</td>
                      <td style={{ fontWeight: 700, color: i.stock <= 0 ? '#b42318' : '#0a7a4b' }}>
                        {qty(i.stock)}
                      </td>
                      <td>{money(i.currentCost)}</td>
                      <td>{money(i.valueAtCost)}</td>
                      <td>{money(i.salePrice)}</td>
                      <td>{money(i.valueAtSale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stockRows.length === 0 && (
                <div className="empty-state">لا أصناف بعد. سجّل فاتورة وارد من المشتريات.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
