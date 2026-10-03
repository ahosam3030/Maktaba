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

type TabId = 'overview' | 'prices' | 'stock';

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

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'danger' | 'neutral';
}) {
  const color =
    tone === 'ok' ? '#0a7a4b' : tone === 'danger' ? '#b42318' : tone === 'warn' ? '#b45309' : '#183b42';
  return (
    <article className="stat-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>
        {value}
      </div>
      {hint ? <div className="hint">{hint}</div> : null}
    </article>
  );
}

export function Reports() {
  const [tab, setTab] = useState<TabId>('overview');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('day');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockQuery, setStockQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'zero' | 'neg'>('all');

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
    let items = summary?.inventory.items || [];
    const q = stockQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.barcode || '').toLowerCase().includes(q),
      );
    }
    if (stockFilter === 'in') items = items.filter((i) => i.stock > 0);
    if (stockFilter === 'zero') items = items.filter((i) => i.stock === 0);
    if (stockFilter === 'neg') items = items.filter((i) => i.stock < 0);
    return items;
  }, [summary, stockQuery, stockFilter]);

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

  const periodLabel =
    from && to ? `من ${from} إلى ${to}` : 'كل الفترات';

  return (
    <div className="purchases-page">
      <div className="purchase-title">
        <div>
          <span className="eyebrow">لوحة مالية</span>
          <h1>التقارير</h1>
          <p>ملخص رأس المال والأرباح، تاريخ أسعار الشراء، وأرصدة المخزون — من بيانات الخادم.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'جارٍ التحديث...' : 'تحديث'}
        </button>
      </div>

      {error && (
        <div className="purchase-notice" role="alert">
          {error}
        </div>
      )}

      <div className="page-tabs" role="tablist">
        <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
          الملخص المالي
        </button>
        <button type="button" className={tab === 'prices' ? 'active' : ''} onClick={() => setTab('prices')}>
          تاريخ الأسعار
        </button>
        <button type="button" className={tab === 'stock' ? 'active' : ''} onClick={() => setTab('stock')}>
          أرصدة المخزون
        </button>
      </div>

      {/* ——— الملخص المالي ——— */}
      {tab === 'overview' && (
        <>
          <section className="purchase-panel">
            <div className="panel-heading">
              <div>
                <h2>الفترة الزمنية</h2>
                <p>تُحسب المبيعات والأرباح والمشتريات ضمن هذه التواريخ. رأس المال والمخزون يعكسان الوضع الحالي.</p>
              </div>
              <span className="count-badge">{periodLabel}</span>
            </div>
            <div className="filter-bar">
              <label>
                من تاريخ
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                إلى تاريخ
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
              <div className="filter-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            </div>
          </section>

          {loading && <div className="empty-state">جارٍ حساب التقارير...</div>}

          {summary && !loading && (
            <>
              <h3 className="reports-section-title">رأس المال (الوضع الحالي)</h3>
              <div className="stat-cards">
                <Kpi
                  label="رأس المال المتبقي (عامل)"
                  value={money(summary.capital.remaining)}
                  hint="نقد + مخزون بالتكلفة − دين الموردين"
                  tone={summary.capital.remaining >= 0 ? 'ok' : 'danger'}
                />
                <Kpi label="رأس المال في البضاعة" value={money(summary.capital.inStock)} hint="قيمة الأرصدة بسعر التكلفة" />
                <Kpi label="رصيد الخزينة" value={money(summary.capital.liquid)} hint="إيرادات − مصروفات (كل الفترات)" />
                <Kpi
                  label="مديونية الموردين"
                  value={money(summary.capital.supplierDebt)}
                  hint="متبقي على فواتير الوارد"
                  tone={summary.capital.supplierDebt > 0 ? 'warn' : 'neutral'}
                />
              </div>

              <h3 className="reports-section-title">أداء الفترة المحددة</h3>
              <div className="stat-cards">
                <Kpi
                  label="صافي المبيعات"
                  value={money(summary.sales.net)}
                  hint={`${summary.sales.count} فاتورة · محصّل ${money(summary.sales.paid)}`}
                />
                <Kpi label="تكلفة البضاعة المباعة" value={money(summary.sales.cogs)} hint="حسب تكلفة الأصناف وقت البيع" />
                <Kpi
                  label="مجمل الربح"
                  value={money(summary.sales.grossProfit)}
                  hint={`هامش ${pct(summary.sales.grossMarginPct)}`}
                  tone={summary.sales.grossProfit >= 0 ? 'ok' : 'danger'}
                />
                <Kpi
                  label="مشتريات الفترة"
                  value={money(summary.purchases.total)}
                  hint={`${summary.purchases.invoicesCount} فاتورة وارد`}
                />
              </div>

              <div className="stat-cards">
                <Kpi label="إيرادات الخزينة (الفترة)" value={money(summary.cash.income)} tone="ok" />
                <Kpi label="مصروفات الخزينة (الفترة)" value={money(summary.cash.expense)} tone="danger" />
                <Kpi
                  label="صافي حركة الخزينة"
                  value={money(summary.cash.net)}
                  tone={summary.cash.net >= 0 ? 'ok' : 'danger'}
                />
                <Kpi
                  label="مخزون — أصناف / وحدات"
                  value={`${summary.inventory.skusInStock} / ${qty(summary.inventory.unitsInStock)}`}
                  hint={`قيمة بيع تقديرية ${money(summary.inventory.valueAtSale)}`}
                />
              </div>

              <section className="purchase-panel">
                <div className="panel-heading">
                  <div>
                    <h2>تسلسل الأرباح ({groupBy === 'day' ? 'يومي' : groupBy === 'month' ? 'شهري' : 'سنوي'})</h2>
                    <p>صافي المبيعات − تكلفة البضاعة المباعة لكل فترة فرعية.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>الفترة</th>
                        <th>فواتير</th>
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
            </>
          )}
        </>
      )}

      {/* ——— تاريخ الأسعار ——— */}
      {tab === 'prices' && <ProductPriceReport />}

      {/* ——— المخزون ——— */}
      {tab === 'stock' && (
        <section className="purchase-panel">
          <div className="panel-heading">
            <div>
              <h2>أرصدة المخزون</h2>
              <p>الرصيد = وارد − مرتجعات − مبيعات ± تسويات. القيمة = الرصيد × تكلفة القطعة.</p>
            </div>
            {summary && (
              <span className="count-badge">
                {summary.inventory.skusTotal} صنف · {qty(summary.inventory.unitsInStock)} وحدة
              </span>
            )}
          </div>

          {loading && <div className="empty-state">جارٍ التحميل...</div>}

          {!loading && summary && (
            <>
              <div className="stat-cards" style={{ marginBottom: 16 }}>
                <Kpi label="قيمة بالتكلفة" value={money(summary.inventory.valueAtCost)} />
                <Kpi label="قيمة بسعر البيع" value={money(summary.inventory.valueAtSale)} />
                <Kpi
                  label="ربح محتمل"
                  value={money(summary.inventory.potentialProfit)}
                  tone={summary.inventory.potentialProfit >= 0 ? 'ok' : 'danger'}
                />
              </div>

              <div className="filter-bar">
                <label className="grow">
                  بحث
                  <input
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    placeholder="اسم الصنف أو باركود"
                  />
                </label>
                <label>
                  الرصيد
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                  >
                    <option value="all">الكل</option>
                    <option value="in">متوفر</option>
                    <option value="zero">صفر</option>
                    <option value="neg">سالب</option>
                  </select>
                </label>
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
                  <div className="empty-state">لا أصناف مطابقة. سجّل فاتورة وارد من المشتريات.</div>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
