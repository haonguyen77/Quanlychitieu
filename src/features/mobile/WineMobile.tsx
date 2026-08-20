import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, BarChart3, FileText, Plus, Users, Package, Trash2, X } from 'lucide-react';
import { deductInventoryForOrder, returnInventoryForOrder, adjustInventoryForEdit, shouldCreateCustomer, getCustomerValues } from './wineService';
import { showConfirm, showPrompt } from './mobileDialog';

type WineTab = 'reports' | 'orders' | 'customers' | 'inventory';

/**
 * WineMobile — Reproduction of Android wine_home_screen.dart.
 * Has its own bottom tabs: Báo cáo, Đơn hàng, +, Khách hàng, Kho.
 */
export function WineMobile() {
  const { pop } = useMobileNav();
  const { data } = useAppStore();
  const { addRecord, deleteRecord, updateRecord } = useRecordStore();
  const [activeTab, setActiveTab] = useState<WineTab>('orders');
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [orderCustomer, setOrderCustomer] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderLines, setOrderLines] = useState<Array<{ name: string; sku: string; qty: string; price: string }>>([{ name: '', sku: '', qty: '1', price: '' }]);
  const [orderShipFee, setOrderShipFee] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));

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
        {activeTab === 'orders' && <WineOrders orders={orders} onDelete={(id) => {
          // Return inventory before delete (Android: _returnInventoryForOrder)
          const record = data?.records.find(r => r.id === id);
          if (record && !record.isDeleted) returnInventoryForOrder(record.values);
          deleteRecord(id);
        }} onEdit={(id) => {
          const order = data?.records.find(r => r.id === id);
          if (!order) return;
          const get = (s: string) => { const k = Object.keys(order.values).find(k => k.endsWith(`_${s}`)); return k ? String(order.values[k] ?? '') : ''; };
          setEditOrderId(id);
          setOrderCustomer(get('customer_name'));
          setOrderPhone(get('customer_phone'));
          setOrderAddress(get('customer_address'));
          // Parse product lines
          const plRaw = order.values['mod_ruou_product_lines'];
          if (plRaw && typeof plRaw === 'string' && String(plRaw).length > 2) {
            try {
              const parsed = JSON.parse(String(plRaw)) as Array<Record<string, string>>;
              setOrderLines(parsed.map(p => ({ name: p.productName || '', sku: p.productSku || '', qty: p.quantity || '1', price: p.price || '0' })));
            } catch { setOrderLines([{ name: get('product_name'), sku: get('product_name'), qty: get('quantity') || '1', price: get('price') }]); }
          } else {
            setOrderLines([{ name: get('product_name'), sku: get('product_name'), qty: get('quantity') || '1', price: get('price') }]);
          }
          setOrderShipFee(get('ship_fee'));
          setOrderDate(get('order_date') || new Date().toISOString().slice(0, 10));
          setShowAddOrder(true);
        }} />}
        {activeTab === 'customers' && <WineCustomers customers={customers} onAdd={async () => {
          const res = await showPrompt({ title: 'Thêm khách hàng', fields: [{ key: 'name', label: 'Họ tên', required: true }, { key: 'phone', label: 'SĐT' }] });
          if (!res) return;
          addRecord('mod_ruou_customers', { mod_ruou_customers_full_name: res.name.trim(), mod_ruou_customers_phone: res.phone || '', mod_ruou_customers_total_orders: 0, mod_ruou_customers_note: '' });
        }} onEdit={async (id) => {
          const record = data?.records.find(r => r.id === id);
          if (!record) return;
          const res = await showPrompt({ title: 'Sửa khách hàng', fields: [
            { key: 'name', label: 'Họ tên', required: true, initialValue: String(record.values['mod_ruou_customers_full_name'] || '') },
            { key: 'phone', label: 'SĐT', initialValue: String(record.values['mod_ruou_customers_phone'] || '') },
          ] });
          if (!res) return;
          updateRecord(id, { ...record.values, mod_ruou_customers_full_name: res.name.trim(), mod_ruou_customers_phone: res.phone });
        }} onDelete={(id) => deleteRecord(id)} />}
        {activeTab === 'inventory' && <WineInventory items={inventory} onAdd={async () => {
          const res = await showPrompt({ title: 'Thêm tồn kho', fields: [
            { key: 'sku', label: 'SKU', required: true },
            { key: 'name', label: 'Tên sản phẩm', required: true },
            { key: 'stock', label: 'Số lượng tồn', numeric: true },
          ] });
          if (!res) return;
          addRecord('mod_ruou_inventory', { mod_ruou_inventory_sku: res.sku.trim(), mod_ruou_inventory_product_name: res.name.trim(), mod_ruou_inventory_stock: Number(res.stock) || 0, mod_ruou_inventory_color: '' });
        }} onEdit={async (id) => {
          const record = data?.records.find(r => r.id === id);
          if (!record) return;
          const res = await showPrompt({ title: 'Sửa tồn kho', fields: [
            { key: 'name', label: 'Tên sản phẩm', required: true, initialValue: String(record.values['mod_ruou_inventory_product_name'] || '') },
            { key: 'stock', label: 'Số lượng tồn', numeric: true, initialValue: String(record.values['mod_ruou_inventory_stock'] || '0') },
          ] });
          if (!res) return;
          updateRecord(id, { ...record.values, mod_ruou_inventory_product_name: res.name.trim(), mod_ruou_inventory_stock: Number(res.stock) || 0 });
        }} onDelete={(id) => deleteRecord(id)} />}
      </div>

      {/* Add Order Modal — matches Android WineOrderFormScreen fields */}
      {showAddOrder && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30" onClick={() => setShowAddOrder(false)}>
          <div className="relative bg-white rounded-t-2xl w-full max-h-[80vh] overflow-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="text-sm font-semibold" style={{ color: '#101B4D' }}>Tạo đơn hàng mới</h3><button onClick={() => setShowAddOrder(false)}><X size={18} color="#666" /></button></div>
            {/* Date with navigation */}
            <div className="flex items-center gap-2">
              <button onClick={() => { const d = new Date(orderDate); d.setDate(d.getDate() - 1); setOrderDate(d.toISOString().slice(0, 10)); }} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">‹</button>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center" />
              <button onClick={() => { const d = new Date(orderDate); d.setDate(d.getDate() + 1); setOrderDate(d.toISOString().slice(0, 10)); }} className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">›</button>
            </div>
            {/* Customer info */}
            <input type="text" value={orderCustomer} onChange={e => setOrderCustomer(e.target.value)} placeholder="Tên khách hàng..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} placeholder="Số điện thoại..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={orderAddress} onChange={e => setOrderAddress(e.target.value)} placeholder="Địa chỉ..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            {/* Product lines — multi-product support (Android: product_lines JSON) */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-600">Sản phẩm</p>
                <button onClick={() => setOrderLines([...orderLines, { name: '', sku: '', qty: '1', price: '' }])} className="text-xs text-purple-600 font-medium">+ Thêm SP</button>
              </div>
              {orderLines.map((line, idx) => (
                <div key={idx} className="mb-2 p-2 bg-gray-50 rounded-lg">
                  <input type="text" value={line.name} onChange={e => { const l = [...orderLines]; l[idx] = { ...l[idx], name: e.target.value }; setOrderLines(l); }} placeholder="Tên sản phẩm..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-1" />
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" value={line.qty} onChange={e => { const l = [...orderLines]; l[idx] = { ...l[idx], qty: e.target.value.replace(/\D/g, '') }; setOrderLines(l); }} placeholder="SL" className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm" />
                    <input type="text" inputMode="numeric" value={line.price} onChange={e => { const l = [...orderLines]; l[idx] = { ...l[idx], price: e.target.value.replace(/\D/g, '') }; setOrderLines(l); }} placeholder="Đơn giá" className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm" />
                    {orderLines.length > 1 && <button onClick={() => setOrderLines(orderLines.filter((_, i) => i !== idx))} className="text-red-400 text-xs px-2">✕</button>}
                  </div>
                </div>
              ))}
            </div>
            {/* Ship + Total */}
            <input type="text" inputMode="numeric" value={orderShipFee} onChange={e => setOrderShipFee(e.target.value.replace(/\D/g, ''))} placeholder="Phí ship (0)" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-gray-500">Tổng cộng:</span>
              <span className="text-sm font-bold" style={{ color: '#6C2BD9' }}>{(orderLines.reduce((s, l) => s + (Number(l.qty) || 1) * (Number(l.price) || 0), 0) + (Number(orderShipFee) || 0)).toLocaleString('vi-VN')}₫</span>
            </div>
            <button onClick={() => {
              if (!orderCustomer.trim()) return;
              const validLines = orderLines.filter(l => l.name.trim());
              const firstLine = validLines[0] || { name: '', sku: '', qty: '1', price: '0' };
              const itemsTotal = validLines.reduce((s, l) => s + (Number(l.qty) || 1) * (Number(l.price) || 0), 0);
              const shipFee = Number(orderShipFee) || 0;
              const total = itemsTotal + shipFee;
              const values: Record<string, string | number | boolean | string[] | null> = {
                mod_ruou_customer_name: orderCustomer.trim(),
                mod_ruou_customer_phone: orderPhone.trim() || null,
                mod_ruou_customer_address: orderAddress.trim() || null,
                mod_ruou_product_name: firstLine.name.trim() || null,
                mod_ruou_product_sku: firstLine.sku.trim() || firstLine.name.trim() || null,
                mod_ruou_quantity: Number(firstLine.qty) || 1,
                mod_ruou_price: Number(firstLine.price) || 0,
                mod_ruou_ship_fee: shipFee,
                mod_ruou_total_amount: total,
                mod_ruou_order_date: orderDate,
              };
              // Multi-product: store as product_lines JSON (matches Android)
              if (validLines.length > 1) {
                values['mod_ruou_product_lines'] = JSON.stringify(validLines.map(l => ({
                  productName: l.name.trim(), productSku: l.sku.trim() || l.name.trim(),
                  quantity: String(Number(l.qty) || 1), price: String(Number(l.price) || 0),
                  color: '', glasses: '0', boxes: '0',
                })));
              }
              if (editOrderId) {
                // Edit: get old values for inventory rollback
                const oldRecord = data?.records.find(r => r.id === editOrderId);
                if (oldRecord) adjustInventoryForEdit(oldRecord.values, values);
                updateRecord(editOrderId, values);
              } else {
                // Create: deduct inventory + ensure customer
                addRecord('mod_ruou', values);
                deductInventoryForOrder(values);
                if (shouldCreateCustomer(values)) {
                  addRecord('mod_ruou_customers', getCustomerValues(values));
                }
              }
              setShowAddOrder(false); setEditOrderId(null); setOrderCustomer(''); setOrderPhone(''); setOrderAddress(''); setOrderLines([{ name: '', sku: '', qty: '1', price: '' }]); setOrderShipFee(''); setOrderDate(new Date().toISOString().slice(0, 10));
            }} className="w-full py-3 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: '#6C2BD9' }}>{editOrderId ? 'Cập nhật' : 'Lưu đơn hàng'}</button>
          </div>
        </div>
      )}

      {/* Wine Bottom Tabs */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 flex items-center justify-around h-14" style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.05)' }}>
        <TabBtn icon={<BarChart3 size={20} />} label="Báo cáo" active={activeTab === 'reports'} onTap={() => setActiveTab('reports')} />
        <TabBtn icon={<FileText size={20} />} label="Đơn hàng" active={activeTab === 'orders'} onTap={() => setActiveTab('orders')} />
        <button onClick={() => setShowAddOrder(true)} className="w-12 h-12 rounded-full flex items-center justify-center -mt-3" style={{ backgroundColor: '#6C2BD9', boxShadow: '0 4px 8px rgba(108,43,217,0.3)', minWidth: '48px', minHeight: '48px' }}>
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

function WineOrders({ orders, onDelete, onEdit }: { orders: { id: string; customer: string; date: string; amount: number }[]; onDelete: (id: string) => void; onEdit: (id: string) => void }) {
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
          <button onClick={() => onEdit(o.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-purple-50"><FileText size={13} className="text-purple-400" /></button>
          <button onClick={async () => { if (await showConfirm({ title: 'Xóa đơn hàng?', confirmLabel: 'Xóa', danger: true })) onDelete(o.id); }} className="w-7 h-7 rounded flex items-center justify-center active:bg-red-50"><Trash2 size={13} className="text-red-400" /></button>
        </div>
      ))}
      {orders.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Chưa có đơn hàng</p>}
    </div>
  );
}

function WineCustomers({ customers, onAdd, onEdit, onDelete }: { customers: { id: string; name: string; phone: string; totalOrders: number }[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{customers.length} khách hàng</h2>
        <button onClick={onAdd} className="text-xs text-purple-600 font-medium">+ Thêm</button>
      </div>
      {customers.map(c => (
        <div key={c.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Users size={16} className="text-blue-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{c.name}</p>
            {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
          </div>
          <span className="text-[10px] text-gray-500">{c.totalOrders} đơn</span>
          <button onClick={() => onEdit(c.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-blue-50"><FileText size={13} className="text-blue-400" /></button>
          <button onClick={async () => { if (await showConfirm({ title: 'Xóa khách hàng?', message: `Xóa "${c.name}"?`, confirmLabel: 'Xóa', danger: true })) onDelete(c.id); }} className="w-7 h-7 rounded flex items-center justify-center active:bg-red-50"><Trash2 size={13} className="text-red-400" /></button>
        </div>
      ))}
      {customers.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Chưa có khách hàng</p>}
    </div>
  );
}

function WineInventory({ items, onAdd, onEdit, onDelete }: { items: { id: string; sku: string; name: string; stock: number; color: string }[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{items.length} sản phẩm</h2>
        <button onClick={onAdd} className="text-xs text-purple-600 font-medium">+ Thêm</button>
      </div>
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
          <button onClick={() => onEdit(i.id)} className="w-7 h-7 rounded flex items-center justify-center active:bg-orange-50"><FileText size={13} className="text-orange-400" /></button>
          <button onClick={async () => { if (await showConfirm({ title: 'Xóa sản phẩm?', message: `Xóa "${i.name}"?`, confirmLabel: 'Xóa', danger: true })) onDelete(i.id); }} className="w-7 h-7 rounded flex items-center justify-center active:bg-red-50"><Trash2 size={13} className="text-red-400" /></button>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Chưa có sản phẩm</p>}
    </div>
  );
}
