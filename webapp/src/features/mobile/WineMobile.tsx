import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, BarChart3, FileText, Plus, Users, Package, Trash2, Search, Receipt, TrendingUp, AlertTriangle, Pencil, Wine } from 'lucide-react';
import { returnInventoryForOrder } from './wineService';
import { showConfirm } from './mobileDialog';
import { WineOrderFormMobile, WineCustomerForm, WineProductsScreenMobile, WineStockInMobile } from './WineScreens';

type WineTab = 'reports' | 'orders' | 'customers' | 'inventory';

const PURPLE = '#6C2BD9';
const NAVY = '#101B4D';
const GREEN = '#16A34A';
const BLUE = '#2563EB';
const ORANGE = '#EA580C';
const RED = '#EF3030';
const BORDER = '#E5E7EB';

/**
 * WineMobile — faithful reproduction of Flutter wine module (home + 4 sub-screens).
 * Tabs: Báo cáo / Đơn hàng / +add / Khách hàng / Kho. Accent purple #6C2BD9.
 */
export function WineMobile() {
  const { pop, push } = useMobileNav();
  const { data } = useAppStore();
  const { deleteRecord } = useRecordStore();
  const [activeTab, setActiveTab] = useState<WineTab>('orders');
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [customerFormId, setCustomerFormId] = useState<string | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const get = (r: { values: Record<string, unknown> }, s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };

  const openAddOrder = () => { setEditOrderId(null); setShowAddOrder(true); };
  const openEditOrder = (id: string) => { setEditOrderId(id); setShowAddOrder(true); };
  const openAddCustomer = () => { setCustomerFormId(null); setShowCustomerForm(true); };
  const openEditCustomer = (id: string) => { setCustomerFormId(id); setShowCustomerForm(true); };
  const openStockIn = () => push({ id: 'wine-stockin', component: <WineStockInMobile /> });
  const openProducts = () => push({ id: 'wine-products', component: <WineProductsScreenMobile /> });

  const orders = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !r.isDeleted && r.moduleId === 'mod_ruou')
      .map(r => {
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_total_amount'));
        return {
          id: r.id, record: r,
          customer: get(r, 'customer_name') || 'Khách lẻ',
          phone: get(r, 'customer_phone'),
          address: [get(r, 'customer_address'), get(r, 'customer_district'), get(r, 'customer_city')].filter(Boolean).join(', '),
          date: get(r, 'order_date'),
          amount: amtKey ? Number(r.values[amtKey] ?? 0) : 0,
          shipFee: Number(get(r, 'ship_fee')) || 0,
          note1: get(r, 'note1'), note2: get(r, 'note2'),
          productName: get(r, 'product_name'), quantity: get(r, 'quantity'), price: get(r, 'price'),
          productLinesRaw: r.values['mod_ruou_product_lines'],
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data]);

  const customers = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_customers')
      .map(r => ({ id: r.id, name: get(r, 'full_name'), phone: get(r, 'phone'),
        address: [get(r, 'address'), get(r, 'district'), get(r, 'city')].filter(Boolean).join(', '),
        totalOrders: Number(get(r, 'total_orders') || 0) }));
  }, [data]);

  const inventory = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_inventory')
      .map(r => ({ id: r.id, sku: get(r, 'sku'), name: get(r, 'product_name'), stock: Number(get(r, 'stock') || 0),
        wineType: get(r, 'wine_type'), bottleType: get(r, 'bottle_type') }));
  }, [data]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header (only for orders/reports which don't have own app bar title) */}
      {activeTab !== 'reports' && (
        <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100">
          <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} style={{ color: NAVY }} /></button>
          <h1 className="text-base font-bold" style={{ color: NAVY }}>
            {activeTab === 'orders' ? 'Đơn hàng' : activeTab === 'customers' ? 'Khách hàng' : 'Kho rượu'}
          </h1>
        </header>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto pb-16">
        {activeTab === 'reports' && <WineReports orders={orders} inventory={inventory} onBack={pop} />}
        {activeTab === 'orders' && <WineOrders orders={orders}
          onDelete={(id) => { const rec = data?.records.find(r => r.id === id); if (rec && !rec.isDeleted) returnInventoryForOrder(rec.values); deleteRecord(id); }}
          onEdit={openEditOrder} />}
        {activeTab === 'customers' && <WineCustomers customers={customers}
          onAdd={openAddCustomer} onEdit={openEditCustomer} onDelete={(id) => deleteRecord(id)} />}
        {activeTab === 'inventory' && <WineInventory items={inventory}
          onOpenProducts={openProducts} onStockIn={openStockIn} onDelete={(id) => deleteRecord(id)} />}
      </div>

      {/* Full-screen order form (create/edit) */}
      {showAddOrder && <WineOrderFormMobile editId={editOrderId} onClose={() => { setShowAddOrder(false); setEditOrderId(null); }} />}

      {/* Customer form (add/edit) */}
      {showCustomerForm && <WineCustomerForm editId={customerFormId} onClose={() => { setShowCustomerForm(false); setCustomerFormId(null); }} />}

      {/* Wine Bottom Tabs */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 flex items-center justify-around h-14" style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.05)' }}>
        <TabBtn icon={<BarChart3 size={20} />} label="Báo cáo" active={activeTab === 'reports'} onTap={() => setActiveTab('reports')} />
        <TabBtn icon={<FileText size={20} />} label="Đơn hàng" active={activeTab === 'orders'} onTap={() => setActiveTab('orders')} />
        <button onClick={() => {
          if (activeTab === 'orders' || activeTab === 'reports') openAddOrder();
          else if (activeTab === 'customers') openAddCustomer();
          else openStockIn();
        }}
          className="w-12 h-12 rounded-full flex items-center justify-center -mt-3" style={{ backgroundColor: PURPLE, boxShadow: '0 4px 8px rgba(108,43,217,0.3)' }}>
          <Plus size={24} color="white" />
        </button>
        <TabBtn icon={<Users size={20} />} label="Khách hàng" active={activeTab === 'customers'} onTap={() => setActiveTab('customers')} />
        <TabBtn icon={<Package size={20} />} label="Kho" active={activeTab === 'inventory'} onTap={() => setActiveTab('inventory')} />
      </nav>
    </div>
  );
}

function TabBtn({ icon, label, active, onTap }: { icon: React.ReactNode; label: string; active: boolean; onTap: () => void }) {
  return (
    <button onClick={onTap} className="flex flex-col items-center gap-0.5" style={{ color: active ? PURPLE : '#9CA3AF' }}>
      {icon}
      <span className="text-[9px]" style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────

function fmtMoney(n: number) { if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M₫`; if (n >= 1000) return `${Math.round(n / 1000)}K₫`; return `${Math.round(n)}₫`; }
function fmtShort(n: number) { if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`; if (n >= 1000) return `${Math.round(n / 1000)}K`; return `${Math.round(n)}`; }

type Period = 'month' | 'year' | 'all';

function WineReports({ orders, inventory }: { orders: Array<{ date: string; amount: number; customer: string; productName: string; quantity: string }>; inventory: Array<{ stock: number }>; onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month');
  const [ref, setRef] = useState(new Date());

  const prefix = period === 'month' ? `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}` : period === 'year' ? `${ref.getFullYear()}` : '';
  const periodLabel = period === 'month' ? `T${ref.getMonth() + 1}/${ref.getFullYear()}` : period === 'year' ? `${ref.getFullYear()}` : 'Tất cả';

  const periodOrders = prefix ? orders.filter(o => (o.date || '').startsWith(prefix)) : orders;
  const totalOrders = periodOrders.length;
  const totalRevenue = periodOrders.reduce((s, o) => s + o.amount, 0);

  // Previous period
  let prevPrefix = '___';
  if (period === 'month') { const pm = ref.getMonth() === 0 ? 12 : ref.getMonth(); const py = ref.getMonth() === 0 ? ref.getFullYear() - 1 : ref.getFullYear(); prevPrefix = `${py}-${String(pm).padStart(2, '0')}`; }
  else if (period === 'year') prevPrefix = `${ref.getFullYear() - 1}`;
  const prevOrders = orders.filter(o => (o.date || '').startsWith(prevPrefix));
  const prevRevenue = prevOrders.reduce((s, o) => s + o.amount, 0);
  const revenueGrowth = prevRevenue > 0 ? Math.round((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
  const orderDiff = totalOrders - prevOrders.length;

  const totalStock = inventory.reduce((s, i) => s + i.stock, 0);
  const totalProducts = inventory.length;
  const lowStock = inventory.filter(i => i.stock <= 4).length;

  // Top products (by qty)
  const productMap = new Map<string, number>();
  const customerMap = new Map<string, number>();
  for (const o of periodOrders) { if (o.productName) productMap.set(o.productName, (productMap.get(o.productName) || 0) + (Number(o.quantity) || 0)); if (o.customer) customerMap.set(o.customer, (customerMap.get(o.customer) || 0) + o.amount); }
  const topProducts = [...productMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCustomers = [...customerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Monthly chart (last 6 months)
  const now = new Date();
  const monthly: Array<{ month: string; revenue: number; orders: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mp = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    const mOrders = orders.filter(o => (o.date || '').startsWith(mp));
    monthly.push({ month: `T${m.getMonth() + 1}`, revenue: mOrders.reduce((s, o) => s + o.amount, 0), orders: mOrders.length });
  }
  const maxRevenue = monthly.reduce((mx, m) => Math.max(mx, m.revenue), 0);

  const navigate = (dir: number) => { const d = new Date(ref); if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRef(d); };

  return (
    <div style={{ backgroundColor: '#F8F9FA' }} className="min-h-full">
      {/* Header */}
      <div className="flex items-center px-4 py-3">
        <h2 className="text-[18px] font-bold" style={{ color: NAVY }}>Báo cáo rượu</h2>
        <span className="ml-auto text-[13px] text-gray-500">{periodLabel}</span>
      </div>
      {/* Period pills */}
      <div className="px-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: BORDER }}>‹</button>
        {(['month', 'year', 'all'] as Period[]).map(p => (
          <button key={p} onClick={() => { setPeriod(p); setRef(new Date()); }} className="flex-1 py-2 rounded-full text-[13px] font-medium text-center"
            style={{ backgroundColor: period === p ? PURPLE : '#fff', color: period === p ? '#fff' : NAVY, border: `1px solid ${period === p ? PURPLE : BORDER}` }}>
            {{ month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
          </button>
        ))}
        <button onClick={() => navigate(1)} className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: BORDER }}>›</button>
      </div>

      <div className="p-4 space-y-3">
        {/* KPI cards 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard icon={<Receipt size={20} color={PURPLE} />} color={PURPLE} title="Đơn hàng" value={`${totalOrders}`} subtitle={`${orderDiff >= 0 ? '+' : ''}${orderDiff} so kỳ trước`} />
          <KpiCard icon={<TrendingUp size={20} color={GREEN} />} color={GREEN} title="Doanh thu" value={fmtMoney(totalRevenue)} subtitle={`${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}%`} />
          <KpiCard icon={<Package size={20} color={BLUE} />} color={BLUE} title="Tồn kho" value={`${totalStock} chai`} subtitle={`${totalProducts} sản phẩm`} />
          <KpiCard icon={<AlertTriangle size={20} color={lowStock > 0 ? ORANGE : '#9CA3AF'} />} color={lowStock > 0 ? ORANGE : '#9CA3AF'} title="Sắp hết" value={`${lowStock} SP`} subtitle="Cần nhập hàng" />
        </div>

        {/* Revenue chart */}
        <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: BORDER }}>
          <p className="text-[14px] font-semibold" style={{ color: NAVY }}>Doanh thu 6 tháng gần nhất</p>
          <div className="flex items-end mt-4" style={{ height: 160 }}>
            {monthly.map((m, i) => {
              const pct = maxRevenue > 0 ? m.revenue / maxRevenue : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end px-1" style={{ height: '100%' }}>
                  {m.revenue > 0 && <span className="text-[8px]" style={{ color: PURPLE }}>{fmtShort(m.revenue)}</span>}
                  {m.orders > 0 && <span className="text-[7px] text-gray-400">{m.orders} đơn</span>}
                  <div className="w-full mt-1" style={{ height: `${Math.max(m.revenue > 0 ? 4 : 0, pct * 100)}px`, backgroundColor: `${PURPLE}B3`, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                  <span className="text-[10px] mt-1.5" style={{ color: NAVY }}>{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: BORDER }}>
          <p className="text-[14px] font-semibold" style={{ color: NAVY }}>Sản phẩm bán chạy</p>
          {topProducts.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">Chưa có dữ liệu</p> : (
            <div className="mt-3 space-y-2">
              {topProducts.map(([name, qty], i) => {
                const maxQty = topProducts[0][1] || 1;
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-5 text-[13px] font-semibold text-gray-500">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: NAVY }}>{name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div style={{ width: `${(qty / maxQty) * 100}%`, height: '100%', backgroundColor: PURPLE }} /></div>
                    </div>
                    <span className="text-[12px] font-semibold" style={{ color: PURPLE }}>{qty} chai</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top customers */}
        <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: BORDER }}>
          <p className="text-[14px] font-semibold" style={{ color: NAVY }}>Khách hàng mua nhiều</p>
          {topCustomers.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">Chưa có dữ liệu</p> : (
            <div className="mt-3 space-y-2.5">
              {topCustomers.map(([name, rev], i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-5 text-[13px] font-semibold text-gray-500">{i + 1}</span>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BLUE}1a` }}><span className="text-[12px] font-bold" style={{ color: BLUE }}>{name ? name[0].toUpperCase() : '?'}</span></div>
                  <span className="flex-1 text-[12px] truncate" style={{ color: NAVY }}>{name}</span>
                  <span className="text-[11px] font-semibold" style={{ color: GREEN }}>{fmtMoney(rev)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, color, title, value, subtitle }: { icon: React.ReactNode; color: string; title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-[14px] border bg-white p-3.5" style={{ borderColor: BORDER }}>
      <div className="flex items-center">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: `${color}1a` }}>{icon}</div>
        <span className="ml-auto text-[11px] text-gray-500">{title}</span>
      </div>
      <p className="mt-2.5 text-[20px] font-bold" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
    </div>
  );
}

// ─── Orders ─────────────────────────────────────────────────────────────

function WineOrders({ orders, onDelete, onEdit }: {
  orders: Array<{ id: string; customer: string; phone: string; address: string; date: string; amount: number; shipFee: number; note1: string; note2: string; productName: string; quantity: string; price: string; productLinesRaw: unknown }>;
  onDelete: (id: string) => void; onEdit: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<Period>('year');
  const nf = (n: number) => Math.round(n).toLocaleString('vi-VN');

  const now = new Date();
  const inPeriod = (d: string) => {
    if (period === 'all' || !d) return true;
    if (period === 'year') return d.startsWith(`${now.getFullYear()}`);
    return d.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };
  const filtered = orders.filter(o => inPeriod(o.date) && (!query.trim() || o.customer.toLowerCase().includes(query.toLowerCase()) || o.phone.includes(query) || o.note1.toLowerCase().includes(query.toLowerCase())));

  const parseLines = (o: typeof orders[0]): Array<{ name: string; qty: number; price: number }> => {
    if (o.productLinesRaw && typeof o.productLinesRaw === 'string' && String(o.productLinesRaw).length > 2) {
      try { return (JSON.parse(String(o.productLinesRaw)) as Array<Record<string, string>>).map(p => ({ name: p.productName || 'SP', qty: Number(p.quantity) || 0, price: Number(p.price) || 0 })); } catch { /* */ }
    }
    if (o.productName) return [{ name: o.productName, qty: Number(o.quantity) || 0, price: Number(o.price) || 0 }];
    return [];
  };

  return (
    <div className="p-4">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border mb-2" style={{ borderColor: BORDER }}>
        <Search size={18} color="#9CA3AF" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm đơn hàng, khách hàng..." className="flex-1 text-sm outline-none" />
      </div>
      {/* Period pills */}
      <div className="flex items-center gap-2 mb-3">
        {(['month', 'year', 'all'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className="px-3 py-1.5 rounded-2xl text-[12px] font-medium"
            style={{ backgroundColor: period === p ? PURPLE : '#F3F4F6', color: period === p ? '#fff' : '#374151' }}>
            {{ month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-gray-500">{filtered.length} đơn</span>
      </div>

      {filtered.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">Chưa có đơn hàng</p> : (
        <div className="space-y-3">
          {filtered.map(o => {
            const lines = parseLines(o);
            return (
              <div key={o.id} className="rounded-xl border p-3.5" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-1.5 mb-2 text-[12px] text-gray-500">📅 {o.date ? o.date.split('-').reverse().join('/') : ''}</div>
                <div className="flex items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold" style={{ color: NAVY }}>{o.customer}</p>
                    {o.phone && <a href={`tel:${o.phone}`} className="text-[12px] text-blue-600 block">📞 {o.phone}</a>}
                    {o.address && <p className="text-[11px] text-gray-500">📍 {o.address}</p>}
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[14px] font-bold" style={{ color: RED }}>{nf(o.amount)} VND</span>
                    {o.shipFee > 0 && <span className="text-[10px] text-blue-600 mt-0.5">Tiền ship: {nf(o.shipFee)} VND</span>}
                  </div>
                </div>
                {lines.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: '#F9F9F9' }}>
                    <div className="flex text-[10px] font-semibold text-gray-400 pb-1 border-b border-gray-200">
                      <span className="flex-[5]">Sản phẩm</span><span className="w-10 text-center">SL</span><span className="flex-[3] text-right">Tiền</span>
                    </div>
                    {lines.map((l, i) => (
                      <div key={i} className="flex text-[11px] pt-1" style={{ color: NAVY }}>
                        <span className="flex-[5] truncate">{l.name}</span><span className="w-10 text-center">{l.qty}</span><span className="flex-[3] text-right">{nf(l.qty * l.price)}đ</span>
                      </div>
                    ))}
                  </div>
                )}
                {(o.note1 || o.note2) && (
                  <div className="mt-1.5">
                    {o.note1 && <p className="text-[11px] italic text-gray-500">📝 {o.note1}</p>}
                    {o.note2 && <p className="text-[11px] italic text-gray-500">📝 {o.note2}</p>}
                  </div>
                )}
                <div className="flex justify-end gap-1 mt-2">
                  <button onClick={() => onEdit(o.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-purple-50"><Pencil size={14} style={{ color: PURPLE }} /></button>
                  <button onClick={async () => { if (await showConfirm({ title: 'Xóa đơn hàng?', confirmLabel: 'Xóa', danger: true })) onDelete(o.id); }} className="w-7 h-7 rounded flex items-center justify-center active:bg-red-50"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Customers ──────────────────────────────────────────────────────────

function WineCustomers({ customers, onAdd, onEdit, onDelete }: { customers: Array<{ id: string; name: string; phone: string; address: string; totalOrders: number }>; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = customers.filter(c => !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query));
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold" style={{ color: NAVY }}>{customers.length} khách hàng</span>
        <button onClick={onAdd} className="text-xs font-medium" style={{ color: PURPLE }}>+ Thêm</button>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border mb-2" style={{ borderColor: BORDER }}>
        <Search size={18} color="#9CA3AF" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm khách hàng..." className="flex-1 text-sm outline-none" />
      </div>
      {filtered.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">Chưa có khách hàng</p> : (
        <div>
          {filtered.map((c, idx) => (
            <div key={c.id} className={`flex items-center gap-3 py-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${PURPLE}1a` }}>
                <span className="text-[14px] font-bold" style={{ color: PURPLE }}>{c.name ? c.name[0].toUpperCase() : '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium" style={{ color: NAVY }}>{c.name}</p>
                {c.phone && <p className="text-[11px] text-blue-600">📞 {c.phone}</p>}
                {c.address && <p className="text-[11px] text-gray-500 truncate">📍 {c.address}</p>}
                <p className="text-[10px] text-gray-400">Đơn: {c.totalOrders}</p>
              </div>
              <button onClick={() => onEdit(c.id)} className="w-7 h-7 rounded flex items-center justify-center"><Pencil size={16} style={{ color: PURPLE }} /></button>
              <button onClick={async () => { if (await showConfirm({ title: 'Xóa khách hàng?', message: `Xóa "${c.name}"?`, confirmLabel: 'Xóa', danger: true })) onDelete(c.id); }} className="w-7 h-7 rounded flex items-center justify-center"><Trash2 size={15} className="text-red-400" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inventory ──────────────────────────────────────────────────────────

function WineInventory({ items, onOpenProducts, onStockIn, onDelete }: { items: Array<{ id: string; sku: string; name: string; stock: number; wineType: string; bottleType: string }>; onOpenProducts: () => void; onStockIn: () => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = items.filter(i => !query.trim() || i.sku.toLowerCase().includes(query.toLowerCase()) || i.name.toLowerCase().includes(query.toLowerCase()));
  const totalStock = filtered.reduce((s, i) => s + i.stock, 0);
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold" style={{ color: NAVY }}>{items.length} sản phẩm</span>
        <button onClick={onOpenProducts} className="text-xs font-medium flex items-center gap-1" style={{ color: PURPLE }}><Wine size={13} /> Sản phẩm</button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: BORDER }}>
          <Search size={18} color="#9CA3AF" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm sản phẩm kho..." className="flex-1 text-sm outline-none" />
        </div>
        <div className="px-3 py-2 rounded-lg text-[12px] font-bold" style={{ backgroundColor: `${PURPLE}1a`, color: PURPLE }}>Tổng: {totalStock}</div>
      </div>
      {filtered.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">Kho trống</p> : (
        <div>
          {filtered.map((i, idx) => {
            const isLow = i.stock <= 4;
            return (
              <div key={i.id} className={`flex items-center gap-3 py-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isLow ? '#EF444419' : `${PURPLE}19` }}>
                  <span className="text-[14px] font-bold" style={{ color: isLow ? '#EF4444' : PURPLE }}>{i.stock}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: NAVY }}>{i.name || i.sku}</p>
                  <p className="text-[10px] text-gray-500">SKU: {i.sku}{i.wineType ? ` • ${i.wineType}` : ''}{i.bottleType ? ` • ${i.bottleType}` : ''}</p>
                </div>
                <button onClick={onStockIn} className="w-7 h-7 rounded flex items-center justify-center" title="Nhập kho"><Pencil size={16} style={{ color: PURPLE }} /></button>
                <button onClick={async () => { if (await showConfirm({ title: 'Xóa sản phẩm?', message: `Xóa "${i.name}"?`, confirmLabel: 'Xóa', danger: true })) onDelete(i.id); }} className="w-7 h-7 rounded flex items-center justify-center"><Trash2 size={15} className="text-red-400" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
