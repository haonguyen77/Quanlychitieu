import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, BarChart3, FileText, Plus, Users, Package, TrendingDown, Calendar } from 'lucide-react';

type WineTab = 'reports' | 'orders' | 'customers' | 'inventory';

/**
 * WineMobile — Reproduction of Android wine_home_screen.dart.
 * Has its own bottom tabs: Báo cáo, Đơn hàng, +, Khách hàng, Kho.
 */
export function WineMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const [activeTab, setActiveTab] = useState<WineTab>('orders');

  const orders = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !r.isDeleted && r.moduleId === 'mod_ruou')
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_total_amount'));
        return { id: r.id, customer: get('customer_name') || 'Khách lẻ', date: get('order_date'), amount: amtKey ? Number(r.values[amtKey] ?? 0) : 0 };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data]);

  const customers = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_customers')
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        return { id: r.id, name: get('full_name'), phone: get('phone'), totalOrders: Number(get('total_orders') || 0) };
      });
  }, [data]);

  const inventory = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !r.isDeleted && r.moduleId === 'mod_ruou_inventory')
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        return { id: r.id, sku: get('sku'), name: get('product_name'), stock: Number(get('stock') || 0), color: get('color') };
      });
  }, [data]);

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
  const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-2 px-2 py-2 border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 flex items-center justify-center"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h1 className="text-base font-bold" style={{ color: '#0F1F4D' }}>Quản lý Rượu</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-16">
        {activeTab === 'reports' && <WineReports totalOrders={orders.length} totalRevenue={totalRevenue} totalStock={inventory.reduce((s, i) => s + i.stock, 0)} />}
        {activeTab === 'orders' && <WineOrders orders={orders} />}
        {activeTab === 'customers' && <WineCustomers customers={customers} />}
        {activeTab === 'inventory' && <WineInventory items={inventory} />}
      </div>

      {/* Wine Bottom Tabs */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 flex items-center justify-around h-14" style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.05)' }}>
        <TabBtn icon={<BarChart3 size={20} />} label="Báo cáo" active={activeTab === 'reports'} onTap={() => setActiveTab('reports')} />
        <TabBtn icon={<FileText size={20} />} label="Đơn hàng" active={activeTab === 'orders'} onTap={() => setActiveTab('orders')} />
        <button className="w-12 h-12 rounded-full flex items-center justify-center -mt-3" style={{ backgroundColor: '#6C2BD9', boxShadow: '0 4px 8px rgba(108,43,217,0.3)', minWidth: '48px', minHeight: '48px' }}>
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
    <button onClick={onTap} className="flex flex-col items-center gap-0.5" style={{ color: active ? '#6C2BD9' : '#9CA3AF' }}>
      {icon}
      <span className="text-[9px]" style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  );
}

function WineReports({ totalOrders, totalRevenue, totalStock }: { totalOrders: number; totalRevenue: number; totalStock: number }) {
  const fmtMoney = (n: number) => { if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M₫`; return `${n.toLocaleString('vi-VN')}₫`; };
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-base font-semibold" style={{ color: '#0F1F4D' }}>Báo cáo rượu</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-200 rounded-xl p-3"><p className="text-[10px] text-gray-500">Đơn hàng</p><p className="text-lg font-bold text-purple-600">{totalOrders}</p></div>
        <div className="border border-gray-200 rounded-xl p-3"><p className="text-[10px] text-gray-500">Doanh thu</p><p className="text-lg font-bold text-green-600">{fmtMoney(totalRevenue)}</p></div>
        <div className="border border-gray-200 rounded-xl p-3"><p className="text-[10px] text-gray-500">Tồn kho</p><p className="text-lg font-bold text-blue-600">{totalStock} chai</p></div>
      </div>
    </div>
  );
}

function WineOrders({ orders }: { orders: { id: string; customer: string; date: string; amount: number }[] }) {
  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">{orders.length} đơn hàng</h2>
      {orders.map(o => (
        <div key={o.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><FileText size={16} className="text-purple-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{o.customer}</p>
            <p className="text-[10px] text-gray-400">{o.date}</p>
          </div>
          <span className="text-xs font-bold text-purple-600">{fmtMoney(o.amount)}₫</span>
        </div>
      ))}
      {orders.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Chưa có đơn hàng</p>}
    </div>
  );
}

function WineCustomers({ customers }: { customers: { id: string; name: string; phone: string; totalOrders: number }[] }) {
  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">{customers.length} khách hàng</h2>
      {customers.map(c => (
        <div key={c.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Users size={16} className="text-blue-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{c.name}</p>
            {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
          </div>
          <span className="text-[10px] text-gray-500">{c.totalOrders} đơn</span>
        </div>
      ))}
      {customers.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Chưa có khách hàng</p>}
    </div>
  );
}

function WineInventory({ items }: { items: { id: string; sku: string; name: string; stock: number; color: string }[] }) {
  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">{items.length} sản phẩm</h2>
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center"><Package size={16} className="text-orange-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{i.name}</p>
            <p className="text-[10px] text-gray-400">SKU: {i.sku}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-orange-600">{i.stock}</p>
            <p className="text-[9px] text-gray-400">chai</p>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Chưa có sản phẩm</p>}
    </div>
  );
}
