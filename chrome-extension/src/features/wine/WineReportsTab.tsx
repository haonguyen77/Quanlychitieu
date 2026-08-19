import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';

interface Props {
  onCustomerClick: (customerName: string) => void;
  onProductClick: (productName: string) => void;
}

type ChartMode = 'day' | 'week' | 'month';

export function WineReportsTab({ onCustomerClick, onProductClick }: Props) {
  const { data } = useAppStore();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [chartMode, setChartMode] = useState<ChartMode>('day');

  const lowThreshold = data?.settings?.wineSettings?.lowStockThreshold ?? 4;

  // Date range for selected month
  const dateFrom = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const dateTo = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const dateRangeLabel = `${String(1).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}/${selectedYear} - ${String(lastDay).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;

  // Orders for selected period
  const periodOrders = useMemo(() => {
    if (!data) return [];
    return data.records.filter((r) => {
      if (r.moduleId !== 'mod_ruou' || r.isDeleted) return false;
      const d = String(r.values['mod_ruou_order_date'] ?? '');
      return d >= dateFrom && d <= dateTo;
    });
  }, [data, dateFrom, dateTo]);

  // Summary stats
  const stats = useMemo(() => {
    let totalRevenue = 0, totalProducts = 0;
    const productMap = new Map<string, { qty: number; sku: string }>();
    const customerMap = new Map<string, number>();
    for (const o of periodOrders) {
      const amount = Number(o.values['mod_ruou_total_amount'] ?? 0);
      const qty = Number(o.values['mod_ruou_quantity'] ?? 0);
      const pName = String(o.values['mod_ruou_product_name'] ?? '');
      const pSku = String(o.values['mod_ruou_product_sku'] ?? '');
      const cName = String(o.values['mod_ruou_customer_name'] ?? '');
      totalRevenue += amount; totalProducts += qty;
      if (pName) { const prev = productMap.get(pName); productMap.set(pName, { qty: (prev?.qty ?? 0) + qty, sku: pSku }); }
      if (cName) customerMap.set(cName, (customerMap.get(cName) ?? 0) + amount);
    }
    const topProducts = Array.from(productMap.entries()).map(([name, { qty, sku }]) => ({ name, qty, sku })).sort((a, b) => b.qty - a.qty).slice(0, 8);
    const topCustomers = Array.from(customerMap.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    // Estimated profit (rough: 30% margin)
    const estimatedProfit = Math.round(totalRevenue * 0.3);
    return { totalOrders: periodOrders.length, totalRevenue, totalProducts, estimatedProfit, topProducts, topCustomers };
  }, [periodOrders]);

  // Previous month for comparison
  const prevMonthRevenue = useMemo(() => {
    if (!data) return 0;
    const pm = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const py = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prefix = `${py}-${String(pm).padStart(2, '0')}`;
    return data.records.filter((r) => r.moduleId === 'mod_ruou' && !r.isDeleted && String(r.values['mod_ruou_order_date'] ?? '').startsWith(prefix))
      .reduce((sum, r) => sum + Number(r.values['mod_ruou_total_amount'] ?? 0), 0);
  }, [data, selectedMonth, selectedYear]);

  const revenueGrowth = prevMonthRevenue ? Math.round(((stats.totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0;

  // Previous month orders and products for comparison
  const prevMonthStats = useMemo(() => {
    if (!data) return { orders: 0, products: 0 };
    const pm = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const py = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prefix = `${py}-${String(pm).padStart(2, '0')}`;
    const prevOrders = data.records.filter((r) => r.moduleId === 'mod_ruou' && !r.isDeleted && String(r.values['mod_ruou_order_date'] ?? '').startsWith(prefix));
    const prevProducts = prevOrders.reduce((sum, r) => sum + Number(r.values['mod_ruou_quantity'] ?? 0), 0);
    return { orders: prevOrders.length, products: prevProducts };
  }, [data, selectedMonth, selectedYear]);

  const ordersDiff = stats.totalOrders - prevMonthStats.orders;
  const productsDiff = stats.totalProducts - prevMonthStats.products;

  // Chart data
  const chartData = useMemo(() => {
    const bars: { label: string; revenue: number; orders: number }[] = [];
    if (chartMode === 'day') {
      for (let d = 1; d <= lastDay; d++) {
        const ds = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOrders = periodOrders.filter((r) => String(r.values['mod_ruou_order_date'] ?? '') === ds);
        bars.push({ label: `${String(d).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}`, revenue: dayOrders.reduce((s, r) => s + Number(r.values['mod_ruou_total_amount'] ?? 0), 0), orders: dayOrders.length });
      }
    } else if (chartMode === 'week') {
      // Group by week
      for (let w = 0; w < 5; w++) {
        const start = w * 7 + 1; const end = Math.min((w + 1) * 7, lastDay);
        if (start > lastDay) break;
        const weekOrders = periodOrders.filter((r) => { const d = Number(String(r.values['mod_ruou_order_date'] ?? '').slice(8, 10)); return d >= start && d <= end; });
        bars.push({ label: `${start}-${end}`, revenue: weekOrders.reduce((s, r) => s + Number(r.values['mod_ruou_total_amount'] ?? 0), 0), orders: weekOrders.length });
      }
    } else {
      // Monthly for the year
      if (!data) return bars;
      for (let m = 1; m <= 12; m++) {
        const prefix = `${selectedYear}-${String(m).padStart(2, '0')}`;
        const mOrders = data.records.filter((r) => r.moduleId === 'mod_ruou' && !r.isDeleted && String(r.values['mod_ruou_order_date'] ?? '').startsWith(prefix));
        bars.push({ label: `T${m}`, revenue: mOrders.reduce((s, r) => s + Number(r.values['mod_ruou_total_amount'] ?? 0), 0), orders: mOrders.length });
      }
    }
    return bars;
  }, [data, periodOrders, chartMode, selectedMonth, selectedYear, lastDay]);

  const maxChartRevenue = Math.max(...chartData.map((b) => b.revenue), 1);

  // Inventory: top 5 sắp hết
  const inventoryData = useMemo(() => {
    if (!data) return { totalProducts: 0, totalStock: 0, topBottleType: '', lowItems: [] as { name: string; sku: string; stock: number }[], byWineType: [] as { label: string; count: number }[] };
    const items = data.records.filter((r) => r.moduleId === 'mod_ruou_inventory' && !r.isDeleted)
      .map((r) => ({ name: String(r.values['mod_ruou_inventory_product_name'] ?? ''), sku: String(r.values['mod_ruou_inventory_sku'] ?? ''), stock: Number(r.values['mod_ruou_inventory_stock'] ?? 0), wineType: String(r.values['mod_ruou_inventory_wine_type'] ?? ''), bottleType: String(r.values['mod_ruou_inventory_bottle_type'] ?? '') }));
    const totalStock = items.reduce((s, i) => s + i.stock, 0);
    const bottleMap = new Map<string, number>(); const wineMap = new Map<string, number>();
    for (const i of items) { bottleMap.set(i.bottleType, (bottleMap.get(i.bottleType) ?? 0) + i.stock); wineMap.set(i.wineType, (wineMap.get(i.wineType) ?? 0) + i.stock); }
    const topBottle = Array.from(bottleMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const getWineLabel = (v: string) => ({ gao: 'Gạo', nep: 'Nếp', dauxanh: 'Đậu xanh', vangnep: 'Vang nếp', dtht: 'ĐTHT' }[v] ?? v);
    const getBottleLabel = (v: string) => ({ pet: 'PET', su: 'Sứ', thuytinh: 'Thuỷ tinh' }[v] ?? v);
    const byWineType = Array.from(wineMap.entries()).map(([v, c]) => ({ label: getWineLabel(v), count: c })).sort((a, b) => b.count - a.count);
    const lowItems = items.filter((i) => i.stock > 0 && i.stock <= lowThreshold).sort((a, b) => a.stock - b.stock).slice(0, 5);
    return { totalProducts: items.length, totalStock, topBottleType: topBottle ? getBottleLabel(topBottle[0]) : '', lowItems, byWineType };
  }, [data, lowThreshold]);

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + '₫';
  const fmtShort = (n: number) => { if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return Math.round(n / 1000) + 'K'; return String(n); };

  return (
    <div className="flex-1 overflow-auto p-5 space-y-4 bg-gray-50 dark:bg-gray-900/50">
      {/* Header: Month/Year picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-[var(--color-border)] px-2 py-1">
          <Icon name="calendar" size={13} className="text-[var(--color-text-secondary)]" />
          <select className="bg-transparent text-xs font-medium text-[var(--color-text)] outline-none" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>T{i + 1}</option>))}
          </select>
        </div>
        <select className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text)]" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
        <button onClick={() => { setSelectedMonth(now.getMonth() + 1); setSelectedYear(now.getFullYear()); }} className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-gray-100">Hôm nay</button>
        <span className="text-[10px] text-[var(--color-text-secondary)] ml-auto">{dateRangeLabel}</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Icon name="file-text" size={16} /></div></div>
          <div className="text-2xl font-bold">{stats.totalOrders} <span className="text-sm font-normal opacity-80">đơn hàng</span></div>
          <div className="text-xs opacity-80">{ordersDiff >= 0 ? '+' : ''}{ordersDiff} đơn hàng so với T{selectedMonth === 1 ? 12 : selectedMonth - 1}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Icon name="trending-up" size={16} /></div></div>
          <div className="text-xl font-bold">{revenueGrowth >= 0 ? '+' : ''}{fmtMoney(stats.totalRevenue - prevMonthRevenue)}</div>
          <div className="text-xs opacity-80">{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}% so với T{selectedMonth === 1 ? 12 : selectedMonth - 1}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
          <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Icon name="wine" size={16} /></div></div>
          <div className="text-2xl font-bold">{stats.totalProducts} <span className="text-sm font-normal opacity-80">chai</span></div>
          <div className="text-xs opacity-80">{productsDiff >= 0 ? '+' : ''}{productsDiff} chai so với T{selectedMonth === 1 ? 12 : selectedMonth - 1}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Icon name="dollar-sign" size={16} /></div></div>
          <div className="text-xl font-bold">{fmtMoney(stats.totalRevenue)}</div>
          <div className="text-xs opacity-80">Tổng doanh thu</div>
        </div>
      </div>

      {/* Revenue Chart + Product Sales */}
      <div className="grid grid-cols-5 gap-4">
        {/* Revenue Chart - 3 cols */}
        <div className="col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Biểu đồ doanh thu</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]"><span className="w-2 h-2 rounded-full bg-purple-500" /> Doanh thu (đ)</span>
              </div>
            </div>
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              {(['day', 'week', 'month'] as ChartMode[]).map((m) => (
                <button key={m} onClick={() => setChartMode(m)} className={`px-2 py-1 text-[10px] font-medium ${chartMode === m ? 'bg-purple-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  {m === 'day' ? 'Theo ngày' : m === 'week' ? 'Theo tuần' : 'Theo tháng'}
                </button>
              ))}
            </div>
          </div>
          {/* Chart area */}
          <div className="relative pt-5 pb-1" style={{ height: '220px' }}>
            {/* Y-axis labels (left - revenue) */}
            <div className="absolute left-0 top-5 bottom-1 w-14 flex flex-col justify-between text-[9px] text-purple-600 pointer-events-none pr-1 text-right">
              <span>{fmtShort(maxChartRevenue)}</span>
              <span>{fmtShort(Math.round(maxChartRevenue / 2))}</span>
              <span>0</span>
            </div>
            {/* Y-axis label title (left) */}
            <div className="absolute left-0 top-0 text-[9px] text-purple-600 font-medium pointer-events-none">Doanh thu (đ)</div>
            {/* Chart content area */}
            <div className="ml-14 mr-2 h-full relative">
              {/* Bars container */}
              <div className="flex items-end h-full relative">
                {chartData.map((bar, i) => {
                  const hPct = maxChartRevenue > 0 ? (bar.revenue / maxChartRevenue) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group" title={`${bar.label}\nDT: ${fmtMoney(bar.revenue)}\nĐơn: ${bar.orders}`}>
                      {/* Revenue amount label on top of bar */}
                      {bar.revenue > 0 && (
                        <span className="text-[8px] text-purple-700 dark:text-purple-300 font-semibold whitespace-nowrap leading-none mb-1">{fmtMoney(bar.revenue)}</span>
                      )}
                      {/* Revenue bar */}
                      <div className="w-[70%] max-w-[28px] bg-gradient-to-t from-purple-600 to-purple-300 dark:from-purple-700 dark:to-purple-400 rounded-t opacity-80 group-hover:opacity-100 transition-opacity" style={{ height: `${Math.max(hPct > 0 ? 3 : 0, hPct)}%` }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* X-axis labels */}
          <div className="flex ml-14 mr-2">
            {chartData.map((bar, i) => (
              <span key={i} className="flex-1 text-[8px] text-[var(--color-text-secondary)] text-center truncate">{chartMode === 'day' ? (i % Math.ceil(chartData.length / 10) === 0 ? bar.label : '') : bar.label}</span>
            ))}
          </div>
        </div>

        {/* Product Sales - 2 cols */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Sản phẩm bán chạy (T{selectedMonth}/{selectedYear})</h3>
          </div>
          <div className="space-y-2">
            {stats.topProducts.map((p, i) => {
              const maxQty = stats.topProducts[0]?.qty || 1;
              return (
                <button key={p.name} onClick={() => onProductClick(p.name)} className="flex items-center gap-2 w-full hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-1 py-1 text-left transition-colors">
                  <span className="text-[10px] font-bold text-purple-600 w-4">{i + 1}</span>
                  <span className="text-[10px] text-[var(--color-text)] w-32 truncate" title={p.name}>{p.name}</span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[var(--color-text)] w-5 text-right">{p.qty}</span>
                  <span className="text-[8px] text-[var(--color-text-secondary)] font-mono w-10 text-right">{p.sku}</span>
                </button>
              );
            })}
            {stats.topProducts.length === 0 && <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">Chưa có dữ liệu</p>}
          </div>
        </div>
      </div>

      {/* Top Customers + Top SP sắp hết */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Top 5 khách hàng</h3>
          <div className="space-y-2">
            {stats.topCustomers.map((c, i) => {
              const maxRev = stats.topCustomers[0]?.revenue || 1;
              const colors = ['bg-indigo-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
              return (
                <button key={c.name} onClick={() => onCustomerClick(c.name)} className="flex items-center gap-2 w-full hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-1 py-1.5 text-left">
                  <span className="text-[10px] font-bold text-purple-600 w-4">{i + 1}</span>
                  <div className={`w-6 h-6 rounded-full ${colors[i] || 'bg-gray-400'} flex items-center justify-center text-white text-[9px] font-bold`}>{c.name.charAt(0).toUpperCase()}</div>
                  <span className="text-xs text-[var(--color-text)] w-16 truncate">{c.name}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[i] || 'bg-gray-400'}`} style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--color-text)] tabular-nums">{fmtMoney(c.revenue)}</span>
                </button>
              );
            })}
            {stats.topCustomers.length === 0 && <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">Chưa có dữ liệu</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Top 5 SP sắp hết hàng</h3>
          <div className="space-y-2">
            {inventoryData.lowItems.map((p, i) => (
              <div key={p.sku} className="flex items-center gap-2 px-1 py-1.5">
                <span className="text-[10px] font-bold text-red-600 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-xs text-[var(--color-text)] font-medium">{p.name}</div>
                  <div className="text-[9px] text-[var(--color-text-secondary)] font-mono">{p.sku}</div>
                </div>
                <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${(p.stock / lowThreshold) * 100}%` }} />
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)]">Tồn: <b className="text-red-600">{p.stock}</b></span>
              </div>
            ))}
            {inventoryData.lowItems.length === 0 && <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">Không có SP sắp hết</p>}
            {inventoryData.lowItems.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-center gap-2">
                <Icon name="alert-triangle" size={14} color="#F59E0B" />
                <span className="text-[10px] text-orange-700 dark:text-orange-300">Cần nhập hàng - Một số sản phẩm sắp hết, vui lòng kiểm tra kho.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Tồn kho tổng quan</h3>
        <div className="grid grid-cols-4 gap-4 items-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-1"><Icon name="building" size={20} color="#2196F3" /></div>
            <div className="text-lg font-bold text-[var(--color-text)]">{inventoryData.totalProducts}</div>
            <div className="text-[9px] text-[var(--color-text-secondary)]">Tổng sản phẩm</div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-1"><Icon name="wine" size={20} color="#9C27B0" /></div>
            <div className="text-lg font-bold text-[var(--color-text)]">{inventoryData.totalStock}</div>
            <div className="text-[9px] text-[var(--color-text-secondary)]">Tổng chai</div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-1"><Icon name="check" size={20} color="#4CAF50" /></div>
            <div className="text-lg font-bold text-[var(--color-text)]">{inventoryData.topBottleType}</div>
            <div className="text-[9px] text-[var(--color-text-secondary)]">Theo loại chai</div>
          </div>
          {/* Mini donut representation */}
          <div>
            <div className="text-[10px] font-medium text-[var(--color-text)] mb-1">Theo loại rượu</div>
            {inventoryData.byWineType.slice(0, 4).map((w) => (
              <div key={w.label} className="flex items-center gap-1 py-0.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-[9px] text-[var(--color-text-secondary)] flex-1">{w.label}</span>
                <span className="text-[9px] font-medium text-[var(--color-text)]">{w.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
